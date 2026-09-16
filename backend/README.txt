BEYOND404 FORENSIC MODULE
=========================

This module creates tamper-evident forensic certificates for the Beyond404
voice-cloning detection system.

Features
--------
- SHA-256 audio-frame hashing
- Hash-chain generation
- Risk score recording
- Network telemetry recording
- JSON certificate generation
- PDF certificate generation
- Certificate integrity verification
- Tamper detection

Run the Test
------------
python test_forensics.py

Create Sample Certificate
-------------------------
python integration_example.py

Generate PDF Certificate
------------------------
python generate_pdf.py

Verify Certificate
------------------
python verify_certificate.py

Expected Verification Output
----------------------------
Certificate loaded successfully.
Certificate integrity: PASS

Important
---------
The current module uses sample audio frames and sample AI/network values
for testing.

During final integration, the backend must provide real 20 ms PCM audio
frames, timestamps, AI risk scores, risk tiers, and WebRTC network telemetry.

The module does not directly manage WebRTC, aiortc, ONNX inference,
Redis, PostgreSQL, FastAPI, or Docker.