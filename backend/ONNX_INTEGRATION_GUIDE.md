# VoiceGuard AI - ONNX Model Integration Guide

This document describes how to integrate the trained **`voiceguard_model.onnx`** model into any backend application (Python FastAPI/Flask, Node.js/Express, Go, Rust, C++, Java, or C#/.NET).

---

## 1. Model Specifications

- **File Name**: `voiceguard_model.onnx`
- **File Size**: `44.13 MB` (Self-contained, FP32 weights included)
- **Architecture**: `SpecResNetClassifier` with Squeeze-and-Excitation Residual Blocks
- **Parameters**: `11,521,730`
- **Trained Dataset**: 100,000 balanced audio samples (ASVspoof 2021 LA + LibriSpeech)
- **Validation Metrics**: ROC-AUC: `0.9220` | EER: `16.28%` | Deepfake Recall: `93.37%`
- **ONNX Opset**: `18`

---

## 2. Model Input & Output Signatures

### **Input Tensor: `mel_spectrogram`**
- **Shape**: `[batch_size, 1, 128, time_steps]`
  - `batch_size`: Dynamic (usually `1` for single requests)
  - `channels`: Exactly `1`
  - `n_mels`: Exactly `128` frequency bins
  - `time_steps`: Dynamic (for a 3.0s clip @ 16kHz with hop length 512, this is `94` frames)
- **Data Type**: `Float32`

### **Output Tensors**
1. **`logits`**: Raw classification logits `[batch_size, 2]` (`Float32`)
2. **`probabilities`**: Softmax normalized probabilities `[batch_size, 2]` (`Float32`)
   - Index `0`: `P(Human / Authentic)`
   - Index `1`: `P(AI / Synthetic / Deepfake)`

---

## 3. Audio Preprocessing Requirements

Before feeding audio into the model, the backend must preprocess the input:
1. **Sample Rate**: Resample to **16,000 Hz** (16 kHz).
2. **Channels**: Convert to **mono** (1 channel).
3. **Standard Length**: Truncate or zero-pad to **3.0 seconds** (48,000 samples).
4. **Log-Mel Spectrogram**:
   - `n_fft`: 1024
   - `hop_length`: 512
   - `n_mels`: 128
   - `f_min`: 20.0 Hz
   - `f_max`: 8000.0 Hz
   - Power: 2.0 (converted to decibels / log scale)
   - Normalized: `(log_mel - mean) / (std + 1e-6)`

---

## 4. Minimal Integration Code Snippets

### Python (FastAPI / Flask / Celery)

```python
import numpy as np
import onnxruntime as ort
import soundfile as sf
import librosa

# Load ONNX session once at server startup
session = ort.InferenceSession("voiceguard_model.onnx", providers=["CPUExecutionProvider"])

def predict_audio(audio_file_path: str):
    # 1. Load audio at 16kHz mono
    y, sr = sf.read(audio_file_path, dtype="float32")
    if y.ndim > 1:
        y = np.mean(y, axis=1)
    if sr != 16000:
        y = librosa.resample(y, orig_sr=sr, target_sr=16000)
        sr = 16000

    # 2. Pad or truncate to 3 seconds (48,000 samples)
    if len(y) < 48000:
        y = np.pad(y, (0, 48000 - len(y)), mode="constant")
    else:
        y = y[:48000]

    # 3. Compute Log-Mel Spectrogram
    mel = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=1024, hop_length=512, n_mels=128, fmin=20.0, fmax=8000.0, power=2.0
    )
    log_mel = librosa.power_to_db(mel, ref=np.max, top_db=80.0)
    norm_mel = (log_mel - np.mean(log_mel)) / (np.std(log_mel) + 1e-6)

    # 4. Reshape for ONNX: [1, 1, 128, time_steps]
    input_tensor = np.expand_dims(norm_mel, axis=(0, 1)).astype(np.float32)

    # 5. Run ONNX Inference
    logits, probabilities = session.run(None, {"mel_spectrogram": input_tensor})

    prob_human = float(probabilities[0, 0])
    prob_ai = float(probabilities[0, 1])

    return {
        "is_deepfake": prob_ai >= 0.5,
        "ai_probability": round(prob_ai * 100, 2),
        "human_probability": round(prob_human * 100, 2),
        "confidence": round(max(prob_ai, prob_human) * 100, 2),
    }
```

### Node.js / TypeScript (using `onnxruntime-node`)

```javascript
const ort = require('onnxruntime-node');

async function runModel(melSpectrogramFloat32Array, timeSteps) {
    const session = await ort.InferenceSession.create('./voiceguard_model.onnx');
    
    // Create tensor: shape [1, 1, 128, timeSteps]
    const tensor = new ort.Tensor('float32', melSpectrogramFloat32Array, [1, 1, 128, timeSteps]);
    
    const results = await session.run({ mel_spectrogram: tensor });
    const probs = results.probabilities.data; // Float32Array [P(Human), P(AI)]
    
    return {
        human_prob: probs[0],
        ai_prob: probs[1]
    };
}
```
