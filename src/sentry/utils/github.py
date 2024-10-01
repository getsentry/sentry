import base64
import binascii
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from pydantic import BaseModel

from sentry import options

from .github_client import GitHubClient


class GitHubKeysPayload(BaseModel):
    public_keys: list[dict[str, Any]]


def verify_signature(payload: str, signature: str, key_id: str, subpath: str) -> None:
    if not payload or not signature or not key_id:
        raise ValueError("Invalid payload, signature, or key_id")

    client_id = options.get("github-login.client-id")
    client_secret = options.get("github-login.client-secret")
    client = GitHubClient(client_id=client_id, client_secret=client_secret)
    response = client.get(f"/meta/public_keys/{subpath}")
    keys = GitHubKeysPayload.parse_obj(response)

    public_key = next((k for k in keys.public_keys if k["key_identifier"] == key_id), None)
    if not public_key:
        raise ValueError("No public key found matching key identifier")

    key = serialization.load_pem_public_key(public_key["key"].encode())

    if not isinstance(key, ec.EllipticCurvePublicKey):
        raise ValueError("Invalid public key type")

    try:
        # Decode the base64 signature to bytes
        signature_bytes = base64.b64decode(signature)
        key.verify(signature_bytes, payload.encode(), ec.ECDSA(hashes.SHA256()))
    except InvalidSignature:
        raise ValueError("Signature does not match payload")
    except binascii.Error:
        raise ValueError("Invalid signature encoding")
