import hashlib
import hmac
from collections.abc import Callable
from typing import Any

import grpc

from sentry import options


def check_grpc_authentication(
    context: grpc.ServicerContext, request_headers: dict | None = None
) -> bool:
    """
    Check authentication for gRPC requests using symmetric keys.

    Returns True if authenticated, False otherwise.
    Sets appropriate error codes on the context if authentication fails.

    Args:
        context: The gRPC context
        request_headers: Optional dict of headers extracted from HTTP request
    """
    # Try to get metadata from the context first
    metadata = {}
    try:
        metadata = dict(context.invocation_metadata() or [])
    except (NotImplementedError, AttributeError):
        # grpcWSGI doesn't implement invocation_metadata
        # Fall back to request_headers if provided
        if request_headers:
            # Convert HTTP headers to gRPC metadata format
            # HTTP headers are case-insensitive but gRPC metadata keys are lowercase
            metadata = {k.lower(): v for k, v in request_headers.items()}

    # Check for symmetric key authentication
    auth_token = metadata.get("x-grpc-auth-token")
    if auth_token:
        # Get allowed tokens from Sentry options
        allowed_tokens = options.get("grpc.auth_tokens", [])
        if isinstance(allowed_tokens, str):
            # Support comma-separated list
            allowed_tokens = [t.strip() for t in allowed_tokens.split(",") if t.strip()]

        if auth_token in allowed_tokens:
            return True

    # Check for HMAC signature (for service-to-service auth)
    signature = metadata.get("x-signature")
    request_body = metadata.get("x-body")
    method = metadata.get("x-method", "")

    if signature and request_body:
        if _validate_signature(signature, method, request_body):
            # Valid service-to-service authentication
            return True

    # No valid authentication found
    context.set_code(grpc.StatusCode.UNAUTHENTICATED)
    context.set_details("Authentication required")
    return False


def _validate_signature(signature: str, method: str, body: str) -> bool:
    """Validate HMAC signature for service-to-service authentication."""
    # Get HMAC shared secrets from Sentry options
    rpc_shared_secrets = options.get("grpc.hmac_secrets", [])

    # Support various formats
    if isinstance(rpc_shared_secrets, str):
        # Support comma-separated list
        if "," in rpc_shared_secrets:
            secrets = [s.strip() for s in rpc_shared_secrets.split(",") if s.strip()]
        else:
            # Single secret
            secrets = [rpc_shared_secrets]
    elif isinstance(rpc_shared_secrets, list):
        secrets = rpc_shared_secrets
    else:
        return False

    if not secrets:
        return False

    # Construct signing payload
    # Convert hex body back to bytes if needed
    try:
        if isinstance(body, str):
            body_bytes = bytes.fromhex(body)
        else:
            body_bytes = body
    except ValueError:
        body_bytes = body.encode("utf-8") if isinstance(body, str) else body

    signing_payload = f"{method}:{body_bytes.hex()}".encode()

    # Try each secret (for key rotation)
    for secret in secrets:
        expected = hmac.new(
            secret.encode("utf-8") if isinstance(secret, str) else secret,
            signing_payload,
            hashlib.sha256,
        ).hexdigest()

        if hmac.compare_digest(signature, expected):
            return True

    return False


class AuthenticationInterceptor(grpc.ServerInterceptor):
    """
    Interceptor to authenticate gRPC requests using API keys or HMAC signatures.

    Note: This is for future use when grpcWSGI supports interceptors.
    For now, authentication is handled within service methods.
    """

    def intercept_service(self, continuation: Callable, handler_call_details: Any) -> Any:
        """Intercept and authenticate incoming gRPC requests."""
        # This would be used if grpcWSGI supported interceptors
        # For now, we handle auth in the service methods
        return continuation(handler_call_details)
