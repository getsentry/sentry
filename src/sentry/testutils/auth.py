import hashlib
import hmac

from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException


def generate_service_request_signature(
    url_path: str,
    body: bytes,
    shared_secret_setting: list[str] | None,
    service_name: str,
    signature_prefix: str = "rpc0",
    include_url_in_signature: bool = False,
) -> str:
    """
    Generate a signature for the request with the first shared secret.
    If there are other shared secrets in the list they are only to be used
    for verification during key rotation.

    Args:
        url_path: The request URL path
        body: The request body to sign. For GET requests (which have no body), use an empty bytes string (b"").
        shared_secret_setting: List of shared secrets from settings
        service_name: Name of the service for error messages
        signature_prefix: Prefix for the signature format (e.g., "rpc0", "service0"). The colon will be added automatically.
        include_url_in_signature: If True, signs "url:body". If False, signs only "body". Defaults to False for backward compatibility.

    NOTE: This function is used only for testing and has been moved from
    production code since no actual services are using it in production yet.
    """

    if not shared_secret_setting:
        raise RpcAuthenticationSetupException(
            f"Cannot sign {service_name} RPC requests without shared secret"
        )

    if include_url_in_signature:
        signature_input = b"%s:%s" % (
            url_path.encode("utf8"),
            body,
        )
    else:
        signature_input = body

    secret = shared_secret_setting[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"{signature_prefix}:{signature}"
