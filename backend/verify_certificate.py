import json
from pathlib import Path

from forensics import verify_chain


def verify_certificate(
    filename="forensic_certificate.json"
):
    certificate_path = Path(__file__).parent / filename

    if not certificate_path.exists():
        print("Certificate file not found.")
        return False

    try:
        with open(
            certificate_path,
            "r",
            encoding="utf-8"
        ) as file:
            certificate = json.load(file)

        chain = certificate.get("chain", [])

        if not chain:
            print("Certificate chain is empty.")
            return False

        result = (
            verify_chain(chain)
            and certificate.get("final_hash") == chain[-1].get("hash")
            )

        print("Certificate loaded successfully.")
        print("Chain length:", len(chain))
        print("Final hash:", certificate.get("final_hash"))
        print("Certificate integrity:", "PASS" if result else "FAIL")

        return result

    except json.JSONDecodeError:
        print("Certificate contains invalid JSON.")
        return False

    except KeyError as error:
        print("Certificate is missing a required field:", error)
        return False


if __name__ == "__main__":
    verify_certificate()