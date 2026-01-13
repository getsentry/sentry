import hashlib
import hmac

from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException


def generate_service_request_signature(
    url_path: str,
    body: bytes,
    shared_secret_setting: list[str] | None,
    service_name: str,
    signature_prefix: str = "rpc0:",
) -> str:
    """
    Generate a signature for the request body with the first shared secret.
    If there are other shared secrets in the list they are only to be used
    for verification during key rotation.

    Args:
        url_path: The request URL path (unused but kept for compatibility)
        body: The request body to sign
        shared_secret_setting: List of shared secrets from settings
        service_name: Name of the service for error messages

    NOTE: This function is used only for testing and has been moved from
    production code since no actual services are using it in production yet.
    """

    if not shared_secret_setting:
        raise RpcAuthenticationSetupException(
            f"Cannot sign {service_name} RPC requests without shared secret"
        )

    signature_input = body
    secret = shared_secret_setting[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"{signature_prefix}{signature}"
