import hashlib
import json
from datetime import datetime
from pathlib import Path


ZERO_HASH = "0" * 64


def calculate_hash(data):
    data_text = json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":")
    )

    return hashlib.sha256(
        data_text.encode("utf-8")
    ).hexdigest()


def hash_audio_frame(audio_frame):
    if not isinstance(audio_frame, bytes):
        raise TypeError("audio_frame must be bytes")

    return hashlib.sha256(audio_frame).hexdigest()


def generate_block(
    prev_hash,
    timestamp,
    score,
    risk_tier,
    telemetry,
    audio_frame=b"",
    frame_index=0
):
    audio_sha256 = hash_audio_frame(audio_frame)

    entry = {
        "frame_index": frame_index,
        "timestamp": timestamp,
        "score": score,
        "risk_tier": risk_tier,
        "audio_sha256": audio_sha256,
        "telemetry": telemetry,
        "prev_hash": prev_hash
    }

    new_hash = calculate_hash(entry)

    entry["hash"] = new_hash

    return new_hash, entry


def export_certificate(chain):
    final_hash = chain[-1]["hash"] if chain else ZERO_HASH

    return {
        "certificate_type": "Voice Clone Forensic Certificate",
        "generated_at": datetime.now().isoformat(),
        "chain_length": len(chain),
        "final_hash": final_hash,
        "chain": chain
    }


def save_certificate(
    certificate,
    filename="forensic_certificate.json"
):
    output_path = Path(__file__).parent / filename

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            certificate,
            file,
            indent=4
        )

    return output_path


def verify_chain(chain):
    previous_hash = ZERO_HASH

    for entry in chain:
        stored_hash = entry.get("hash")

        entry_without_hash = {
            "frame_index": entry["frame_index"],
            "timestamp": entry["timestamp"],
            "score": entry["score"],
            "risk_tier": entry["risk_tier"],
            "audio_sha256": entry["audio_sha256"],
            "telemetry": entry["telemetry"],
            "prev_hash": entry["prev_hash"]
        }

        recalculated_hash = calculate_hash(
            entry_without_hash
        )

        if entry["prev_hash"] != previous_hash:
            return False

        if stored_hash != recalculated_hash:
            return False

        previous_hash = stored_hash

    return True