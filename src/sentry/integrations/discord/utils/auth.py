from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


def verify_signature(public_key_string: str, signature: str, timestamp: str, body: str) -> None:
    public_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_string))
    public_key.verify(bytes.fromhex(signature), f"{timestamp}{body}".encode())
