import hashlib
import wave


FRAME_DURATION_MS = 20
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2


def hash_audio_frame(audio_frame):
    """
    Generate SHA-256 hash for one audio frame.
    """

    return hashlib.sha256(audio_frame).hexdigest()


def split_audio_into_frames(audio_file):
    """
    Split a WAV audio file into 20 ms frames.

    Expected audio format:
    - 16 kHz sample rate
    - Mono channel
    - 16-bit PCM
    """

    frames = []

    with wave.open(audio_file, "rb") as wav_file:
        sample_rate = wav_file.getframerate()
        channels = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()

        if sample_rate != SAMPLE_RATE:
            raise ValueError("Audio must have a 16 kHz sample rate")

        if channels != CHANNELS:
            raise ValueError("Audio must be mono")

        if sample_width != SAMPLE_WIDTH:
            raise ValueError("Audio must use 16-bit PCM")

        frame_size = int(
            SAMPLE_RATE * FRAME_DURATION_MS / 1000
        ) * SAMPLE_WIDTH

        frame_index = 0
        timestamp_ms = 0

        while True:
            audio_frame = wav_file.readframes(
                frame_size // SAMPLE_WIDTH
            )

            if not audio_frame:
                break

            frames.append({
                "frame_index": frame_index,
                "timestamp_ms": timestamp_ms,
                "audio_sha256": hash_audio_frame(audio_frame)
            })

            frame_index += 1
            timestamp_ms += FRAME_DURATION_MS

    return frames


if __name__ == "__main__":
    print("audio_hash.py is ready.")
    print("Use split_audio_into_frames() with a 16 kHz mono WAV file.")