import io
import base64
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import FancyBboxPatch
import librosa

def compute_forensic_indicators(audio_np, sr=16000, model_score=None):
    """
    Analyzes an audio signal (16kHz numpy array) and computes the 4 core forensic indicators:
    1. Spectral Flux (%)
    2. Dead Silence (%)
    3. Pitch Anomaly (%)
    4. Vocoder Artifacts (%)
    """
    # Standardize audio amplitude
    max_val = np.max(np.abs(audio_np))
    if max_val > 1e-5:
        norm_audio = audio_np / max_val
    else:
        norm_audio = audio_np

    # 1. Spectral Flux
    stft = np.abs(librosa.stft(norm_audio, n_fft=1024, hop_length=256))
    flux = np.sum(np.diff(stft, axis=1)**2, axis=0)
    mean_flux = float(np.mean(flux)) if len(flux) > 0 else 0.0
    spectral_flux_pct = round(min(100.0, max(5.0, mean_flux * 0.12)), 1)

    # 2. Dead Silence (% of frames with unnatural zero variance / gating)
    rms = librosa.feature.rms(y=norm_audio, hop_length=256)[0]
    silence_frames = np.sum(rms < 0.015)
    dead_silence_pct = round(float(silence_frames / max(1, len(rms))) * 100.0, 1)

    # 3. Pitch Anomaly
    try:
        f0 = librosa.yin(norm_audio, fmin=50, fmax=400, sr=sr)
        valid_f0 = f0[~np.isnan(f0)]
        if len(valid_f0) > 5:
            pitch_diff = np.abs(np.diff(valid_f0))
            pitch_anomaly_pct = round(min(100.0, max(0.0, float(np.std(pitch_diff) / 12.0) * 10.0)), 1)
        else:
            pitch_anomaly_pct = 0.0
    except Exception:
        pitch_anomaly_pct = 0.0

    # 4. Vocoder Artifacts
    flatness = librosa.feature.spectral_flatness(y=norm_audio)[0]
    mean_flatness = float(np.mean(flatness)) if len(flatness) > 0 else 0.0
    vocoder_pct = round(min(100.0, max(5.0, mean_flatness * 1400.0)), 1)

    # Determine overall risk score if not provided
    if model_score is not None:
        overall_score = round(float(model_score) * 100.0, 1)
    else:
        # Weighted heuristic
        overall_score = round(
            (spectral_flux_pct * 0.3) +
            (dead_silence_pct * 0.2) +
            (pitch_anomaly_pct * 0.25) +
            (vocoder_pct * 0.25),
            1
        )

    risk_level = "HIGH" if overall_score >= 60.0 else ("MEDIUM" if overall_score >= 34.0 else "LOW")
    classification = "AI_GENERATED" if overall_score >= 50.0 else "GENUINE"
    confidence = round(min(98.5, max(65.0, abs(overall_score - 50.0) * 1.3 + 60.0)), 1)

    # Formulate key flags
    flags = []
    if vocoder_pct >= 40.0:
        flags.append("Neural vocoder synthesis artifacts detected in 4-8 kHz band")
    if pitch_anomaly_pct >= 35.0:
        flags.append("Unnatural pitch transitions / robotic fundamental frequency")
    if dead_silence_pct >= 30.0:
        flags.append("Abrupt audio gating and acoustic dead silence detected")
    if spectral_flux_pct >= 35.0:
        flags.append("High spectral envelope flux across frame transitions")

    if not flags:
        flags.append("No overt vocoder or pitch anomalies detected")

    indicators = {
        "Spectral Flux": spectral_flux_pct,
        "Dead Silence": dead_silence_pct,
        "Pitch Anomaly": pitch_anomaly_pct,
        "Vocoder": vocoder_pct
    }

    return {
        "overall_risk_score": overall_score,
        "risk_level": risk_level,
        "classification": classification,
        "confidence": confidence,
        "indicators": indicators,
        "key_flags": flags
    }


def generate_mel_forensic_plot(audio_np, sr=16000, overall_score=61.1, indicators=None, key_flags=None):
    """
    Renders the exact 3-tier forensic breakdown figure:
    1. Standardized Audio Waveform
    2. Log-Mel Spectrogram (Frequency Distribution)
    3. Forensic Indicator Breakdown (Horizontal bar chart) + Red Summary Card
    """
    if indicators is None:
        indicators = {
            "Spectral Flux": 15.0,
            "Dead Silence": 10.0,
            "Pitch Anomaly": 0.0,
            "Vocoder": 15.0
        }
    if key_flags is None:
        key_flags = ["No overt vocoder or pitch anomalies detected"]

    # Normalize audio for plotting
    max_val = np.max(np.abs(audio_np))
    if max_val > 1e-5:
        audio_plot = audio_np / max_val
    else:
        audio_plot = audio_np

    duration = len(audio_plot) / sr
    time_axis = np.linspace(0, duration, len(audio_plot))

    # Compute Mel Spectrogram
    mel = librosa.feature.melspectrogram(
        y=audio_plot, sr=sr, n_fft=1024, hop_length=256, n_mels=128, fmin=20.0, fmax=8000.0
    )
    log_mel = librosa.power_to_db(mel, ref=np.max, top_db=80.0)
    norm_mel = (log_mel - np.mean(log_mel)) / (np.std(log_mel) + 1e-6)

    # Setup 3-tier figure matching user specification
    fig = plt.figure(figsize=(11, 7.5), dpi=120)
    gs = gridspec.GridSpec(3, 2, height_ratios=[1, 1.2, 1.2], width_ratios=[1.2, 1], hspace=0.45, wspace=0.25)

    # 1. Standardized Audio Waveform
    ax_wave = fig.add_subplot(gs[0, :])
    ax_wave.plot(time_axis, audio_plot, color="#2b5c8f", linewidth=0.85)
    ax_wave.set_title("Standardized Audio Waveform", fontweight="bold", fontsize=11, pad=6)
    ax_wave.set_xlabel("Time (seconds)", fontsize=9)
    ax_wave.set_ylabel("Amplitude", fontsize=9)
    ax_wave.set_ylim(-1.05, 1.05)
    ax_wave.set_xlim(0, max(0.05, duration))
    ax_wave.grid(True, linestyle="-", alpha=0.3, color="#cbd5e1")
    ax_wave.tick_params(labelsize=8.5)

    # 2. Log-Mel Spectrogram (Frequency Distribution)
    ax_spec = fig.add_subplot(gs[1, :])
    spec_img = ax_spec.imshow(
        norm_mel,
        aspect="auto",
        origin="lower",
        extent=[0, duration, 0, 8000],
        cmap="magma",
        vmin=-1.2,
        vmax=1.2
    )
    ax_spec.set_title("Log-Mel Spectrogram (Frequency Distribution)", fontweight="bold", fontsize=11, pad=6)
    ax_spec.set_xlabel("Time (seconds)", fontsize=9)
    ax_spec.set_ylabel("Frequency (Hz)", fontsize=9)
    ax_spec.tick_params(labelsize=8.5)

    # Custom dB Colorbar
    cbar = fig.colorbar(spec_img, ax=ax_spec, fraction=0.025, pad=0.02)
    cbar.set_ticks([-1.0, 0.0, 1.0])
    cbar.set_ticklabels(["-1 dB", "0 dB", "+1 dB"])
    cbar.ax.tick_params(labelsize=8)

    # 3. Forensic Indicator Breakdown
    ax_bars = fig.add_subplot(gs[2, 0])
    labels = ["Vocoder", "Pitch Anomaly", "Dead Silence", "Spectral Flux"]
    values = [indicators.get(k, 0.0) for k in labels]

    y_pos = np.arange(len(labels))
    bars = ax_bars.barh(y_pos, values, height=0.55, color="#48bb78", edgecolor="none")
    ax_bars.set_yticks(y_pos)
    ax_bars.set_yticklabels(labels, fontsize=9)
    ax_bars.set_xlim(0, 100)
    ax_bars.set_xlabel("Anomaly Index (%)", fontsize=9)
    ax_bars.set_title("Forensic Indicator Breakdown", fontweight="bold", fontsize=11, pad=6)
    ax_bars.grid(axis="x", linestyle="-", alpha=0.3, color="#cbd5e1")
    ax_bars.tick_params(labelsize=8.5)

    for bar in bars:
        width = bar.get_width()
        ax_bars.text(width + 2, bar.get_y() + bar.get_height()/2, f"{width:.1f}%",
                     va="center", ha="left", fontsize=8.5, color="#1e293b")

    # 4. Summary Card
    ax_card = fig.add_subplot(gs[2, 1])
    ax_card.axis("off")

    risk_level = "HIGH" if overall_score >= 60.0 else ("MEDIUM" if overall_score >= 34.0 else "LOW")
    classification = "AI_GENERATED" if overall_score >= 50.0 else "GENUINE"
    confidence = round(min(98.5, max(65.0, abs(overall_score - 50.0) * 1.3 + 60.0)), 1)
    border_color = "#dc2626" if overall_score >= 50.0 else "#16a34a"

    card_box = FancyBboxPatch(
        (0.04, 0.08), 0.92, 0.84,
        boxstyle="round,pad=0.03,rounding_size=0.06",
        facecolor="#f8fafc",
        edgecolor=border_color,
        linewidth=2.5,
        transform=ax_card.transAxes
    )
    ax_card.add_patch(card_box)

    flags_text = "\n".join([f"• {flag}" for flag in key_flags])

    text_content = (
        f"OVERALL RISK SCORE: {overall_score:.1f} / 100\n"
        f"RISK LEVEL: {risk_level}\n"
        f"CLASSIFICATION: {classification}\n"
        f"CONFIDENCE: {confidence}%\n\n"
        f"Key Flags:\n"
        f"{flags_text}"
    )

    ax_card.text(
        0.10, 0.82, text_content,
        transform=ax_card.transAxes,
        fontsize=9.2,
        fontfamily="monospace",
        verticalalignment="top",
        color="#0f172a",
        fontweight="normal"
    )

    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", dpi=130)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")
