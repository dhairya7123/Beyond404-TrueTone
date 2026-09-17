"""
Diagnostic utility to inspect both the active Wav2Vec2 'local_model'
and the preserved 'model.onnx' baseline model.
"""

from pathlib import Path
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
LOCAL_MODEL_DIR = BASE_DIR / "local_model"
ONNX_PATH = BASE_DIR / "model.onnx"

print("=" * 60)
print("1. CHECKING ACTIVE INFERENCE ENGINE: 'local_model' (Pretrained Wav2Vec2)")
print("=" * 60)
try:
    from local_model import local_model
    print(f"Engine Status: READY ({local_model.model_name})")
    print(f"Model Directory: {LOCAL_MODEL_DIR}")
    
    # Test sample inference
    dummy_audio = np.random.uniform(-0.1, 0.1, 16000).astype(np.float32)
    res = local_model.predict(dummy_audio)
    print(f"Test 1s Audio Inference:")
    print(f"  - Fraud Score:     {res['score']:.4f}")
    print(f"  - Classification:  {res['classification']}")
    print(f"  - Confidence:      {res['confidence']}%")
    print(f"  - Latency:         {res['inference_time_ms']:.1f}ms")
    print("SUCCESS: Pretrained Wav2Vec2 'local_model' is fully functional.")
except Exception as e:
    print(f"Error loading local_model (Wav2Vec2): {e}")

print("\n" + "=" * 60)
print("2. CHECKING PRESERVED ORIGINAL ONNX MODEL: 'model.onnx'")
print("=" * 60)
try:
    import onnxruntime as ort
    if ONNX_PATH.exists():
        session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
        print(f"File Path: {ONNX_PATH} (PRESERVED)")
        print("\n--- ONNX INPUTS ---")
        for i in session.get_inputs():
            print(f"Name: {i.name} | Shape: {i.shape} | Type: {i.type}")

        print("\n--- ONNX OUTPUTS ---")
        for o in session.get_outputs():
            print(f"Name: {o.name} | Shape: {o.shape} | Type: {o.type}")
        print("SUCCESS: Original model.onnx remains intact and accessible.")
    else:
        print(f"WARNING: {ONNX_PATH} not found.")
except Exception as e:
    print(f"Error loading original ONNX model: {e}")

print("=" * 60)
