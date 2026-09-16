from datetime import datetime

from forensics import (
    ZERO_HASH,
    generate_block,
    export_certificate,
    save_certificate,
    verify_chain
)


chain = []

previous_hash = ZERO_HASH

sample_frames = [
    {
        "audio_frame": b"sample audio frame one",
        "score": 0.82,
        "risk_tier": "High Risk"
    },
    {
        "audio_frame": b"sample audio frame two",
        "score": 0.24,
        "risk_tier": "Low Risk"
    }
]

for index, frame in enumerate(sample_frames):
    new_hash, entry = generate_block(
        prev_hash=previous_hash,
        timestamp=datetime.now().isoformat(),
        score=frame["score"],
        risk_tier=frame["risk_tier"],
        telemetry={
            "packet_loss": 2.5,
            "jitter_ms": 18.4,
            "codec": "Opus",
            "plc_status": "active"
        },
        audio_frame=frame["audio_frame"],
        frame_index=index
    )

    chain.append(entry)
    previous_hash = new_hash


certificate = export_certificate(chain)

save_certificate(
    certificate,
    filename="sample_certificate.json"
)

print("Sample certificate created successfully.")
print("Chain valid:", verify_chain(chain))