from typing import Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from rest_framework import status


def verify_signature(
    public_key_string: str, signature: Optional[str], timestamp: Optional[str] | None, body: str
) -> None:
    try:
        public_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_string))
        public_key.verify(bytes.fromhex(signature), f"{timestamp}{body}".encode())
    except (InvalidSignature, ValueError):
        from sentry.integrations.discord.requests.base import DiscordRequestError

        raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)
