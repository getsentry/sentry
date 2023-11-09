from venv import logger

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


def verify_signature(public_key_string: str, signature: str, message: str) -> bool:
    try:
        public_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_string))
        public_key.verify(bytes.fromhex(signature), message.encode("utf-8"))
        return True
    except (InvalidSignature, ValueError):
        logger.info("discord.auth.verify.signature.false", extra={"message": message})
        return False
