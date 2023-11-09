from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from rest_framework import status

from sentry.integrations.discord.requests.base import DiscordRequestError

from ..utils import logger


def verify_signature(public_key_string: str, signature: str, timestamp: str, body: str) -> None:
    try:
        public_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_string))
        public_key.verify(bytes.fromhex(signature), f"{timestamp}{body}".encode())
    except (InvalidSignature, ValueError):
        logger.info(
            "discord.auth.verify.signature.false", extra={"timestamp": timestamp, "body": body}
        )
        raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)
