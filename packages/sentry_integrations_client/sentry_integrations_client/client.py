"""gRPC-Web client for Sentry integrations service using Sonora."""

import hashlib
import hmac
import ssl

import urllib3
from sonora.client import UnaryUnaryCall, UnaryUnaryMulticallable, WebChannel


class AuthUnaryUnaryMulticallable(UnaryUnaryMulticallable):
    """
    Custom UnaryUnaryMulticallable that injects auth headers.

    This extends Sonora's UnaryUnaryMulticallable to automatically inject
    authentication headers (token or HMAC) into every request.
    """

    def __init__(
        self,
        session,
        url,
        path,
        request_serializer,
        response_deserializer,
        auth_token: str | None = None,
        hmac_secret: str | None = None,
    ):
        super().__init__(session, url, path, request_serializer, response_deserializer)
        self._auth_token = auth_token
        self._hmac_secret = hmac_secret
        self._path = path

    def with_call(self, request, timeout=None, metadata=None):
        """Override to inject auth headers into metadata."""
        # Start with base metadata
        call_metadata = self._metadata.copy()

        # Inject auth headers
        if self._auth_token:
            # Token-based authentication
            call_metadata.append(("X-Grpc-Auth-Token", self._auth_token))
        elif self._hmac_secret:
            # HMAC-based authentication
            body_bytes = request.SerializeToString()
            body_hex = body_bytes.hex()
            signing_payload = f"{self._path}:{body_hex}".encode()
            signature = hmac.new(
                self._hmac_secret.encode("utf-8"), signing_payload, hashlib.sha256
            ).hexdigest()
            call_metadata.append(("X-Signature", signature))
            call_metadata.append(("X-Body", body_hex))
            call_metadata.append(("X-Method", self._path))

        # Add any additional metadata passed in
        if metadata is not None:
            from sonora import protocol

            call_metadata.extend(protocol.encode_headers(metadata))

        # Create the call with updated metadata
        call = UnaryUnaryCall(
            request,
            timeout,
            call_metadata,
            self._rpc_url,
            self._session,
            self._serializer,
            self._deserializer,
        )

        return call(), call


class AuthWebChannel(WebChannel):
    """
    Custom WebChannel that returns AuthUnaryUnaryMulticallable with auth injection.

    This extends Sonora's WebChannel to automatically inject authentication
    headers into all unary_unary calls.
    """

    def __init__(
        self,
        url: str,
        auth_token: str | None = None,
        hmac_secret: str | None = None,
        verify_ssl: bool = False,
    ):
        super().__init__(url)
        self._auth_token = auth_token
        self._hmac_secret = hmac_secret
        self._verify_ssl = verify_ssl

        # Configure session for SSL verification
        if not verify_ssl:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            # Create a new PoolManager with SSL verification disabled
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            self._session = urllib3.PoolManager(ssl_context=ssl_context)

    def unary_unary(self, path, request_serializer, response_deserializer, **kwargs):
        """Return custom multicallable with auth injection."""
        return AuthUnaryUnaryMulticallable(
            self._session,
            self._url,
            path,
            request_serializer,
            response_deserializer,
            auth_token=self._auth_token,
            hmac_secret=self._hmac_secret,
        )


def grpc_channel(
    base_url: str,
    auth_token: str | None = None,
    hmac_secret: str | None = None,
    verify_ssl: bool = False,
) -> AuthWebChannel:
    """
    Create a WebChannel with authentication support for gRPC-Web clients.

    Args:
        base_url: Base URL of the gRPC service (e.g., "https://dev.getsentry.net:8000")
        auth_token: Optional authentication token for token-based auth
        hmac_secret: Optional HMAC secret for service-to-service auth
        verify_ssl: Whether to verify SSL certificates (default: False for dev)

    Returns:
        AuthWebChannel instance that can be used with gRPC service stubs

    Example:
        channel = grpc_channel(
            base_url="https://dev.getsentry.net:8000",
            auth_token="my-token"
        )
        stub = scm_pb2_grpc.ScmServiceStub(channel)
        response = stub.GetRepositories(request)
    """
    return AuthWebChannel(
        url=base_url, auth_token=auth_token, hmac_secret=hmac_secret, verify_ssl=verify_ssl
    )
