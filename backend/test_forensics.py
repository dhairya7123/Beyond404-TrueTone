from forensics import (
    ZERO_HASH,
    generate_block,
    export_certificate,
    save_certificate,
    verify_chain
)

import json


chain = []

audio_frame_1 = b"sample raw pcm audio frame one"
audio_frame_2 = b"sample raw pcm audio frame two"

previous_hash = ZERO_HASH


for index, audio_frame in enumerate(
    [audio_frame_1, audio_frame_2]
):
    new_hash, entry = generate_block(
        prev_hash=previous_hash,
        timestamp=f"2026-09-14T12:00:{index:02d}",
        score=0.85 if index == 0 else 0.25,
        risk_tier="High Risk" if index == 0 else "Low Risk",
        telemetry={
            "packet_loss": 2.5,
            "jitter_ms": 18.4,
            "codec": "Opus",
            "plc_status": "active"
        },
        audio_frame=audio_frame,
        frame_index=index
    )

    chain.append(entry)
    previous_hash = new_hash


certificate = export_certificate(chain)

certificate_path = save_certificate(certificate)

print("Certificate saved at:")
print(certificate_path)

print("\nHash chain valid:")
print(verify_chain(chain))

print("\nTesting tamper detection...")

chain[0]["score"] = 0.10

print("Verification after modification:")
print(verify_chain(chain))

print("\nCertificate:")
print(json.dumps(certificate, indent=4))