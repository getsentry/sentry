from __future__ import annotations

import logging
from urllib.parse import urlparse

import orjson
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread

logger = logging.getLogger("sentry.oauth.cimd")


class CIMDFetchError(Exception):
    """Exception raised when CIMD metadata document cannot be fetched."""


class CIMDValidationError(Exception):
    """Exception raised when CIMD metadata document fails validation."""


# Fields that MUST NOT appear in CIMD documents (per RFC)
PROHIBITED_FIELDS: frozenset[str] = frozenset(
    {
        "client_secret",
        "client_secret_expires_at",
    }
)

# Auth methods that are prohibited for CIMD clients (require client secrets)
PROHIBITED_AUTH_METHODS: frozenset[str] = frozenset(
    {
        "client_secret_post",
        "client_secret_basic",
        "client_secret_jwt",
    }
)

# Valid auth methods for CIMD clients
VALID_AUTH_METHODS: frozenset[str] = frozenset(
    {
        "none",
        "private_key_jwt",
        "tls_client_auth",
    }
)


def validate_cimd_document(document: dict, client_id_url: str) -> None:
    """
    Validate a CIMD document per RFC draft-ietf-oauth-client-id-metadata-document.

    Args:
        document: The parsed CIMD metadata document.
        client_id_url: The URL from which the document was fetched.

    Raises:
        CIMDValidationError: If the document fails validation.
    """
    # 1. client_id MUST exist and MUST exactly match the fetch URL
    # Per RFC 3986 §6.2.1, simple string comparison is used
    client_id = document.get("client_id")
    if client_id is None:
        raise CIMDValidationError("Missing required field: client_id")

    if client_id != client_id_url:
        raise CIMDValidationError(
            f"client_id mismatch: document contains '{client_id}' but was fetched from '{client_id_url}'"
        )

    # 2. Prohibited fields MUST NOT appear
    for field in PROHIBITED_FIELDS:
        if field in document:
            raise CIMDValidationError(f"Prohibited field present: {field}")

    # 3. token_endpoint_auth_method validation
    auth_method = document.get("token_endpoint_auth_method")
    if auth_method is not None and auth_method not in VALID_AUTH_METHODS:
        # Provide specific error for prohibited methods (require client secrets)
        if auth_method in PROHIBITED_AUTH_METHODS:
            raise CIMDValidationError(f"Prohibited authentication method: {auth_method}")
        raise CIMDValidationError(f"Invalid authentication method: {auth_method}")

    # 4. redirect_uris validation
    redirect_uris = document.get("redirect_uris")
    if redirect_uris is not None:
        if not isinstance(redirect_uris, list):
            raise CIMDValidationError("redirect_uris must be an array")

        if not all(isinstance(uri, str) for uri in redirect_uris):
            raise CIMDValidationError("redirect_uris must contain only strings")

        # Validate redirect_uri origins match client_id origin (Sentry policy)
        client_origin = _get_origin(client_id_url)
        for uri in redirect_uris:
            redirect_origin = _get_origin(uri)
            if redirect_origin != client_origin:
                raise CIMDValidationError(
                    f"redirect_uri origin '{redirect_origin}' does not match client_id origin '{client_origin}'"
                )

    # 5. Optional field type validation
    _validate_optional_string_array(document, "grant_types")
    _validate_optional_string_array(document, "response_types")

    # 6. jwks_uri validation (if present, must be a valid HTTPS URL)
    jwks_uri = document.get("jwks_uri")
    if jwks_uri is not None:
        if not isinstance(jwks_uri, str):
            raise CIMDValidationError("jwks_uri must be a string")
        if urlparse(jwks_uri).scheme != "https":
            raise CIMDValidationError("jwks_uri must use HTTPS")

    # 7. jwks validation (if present, must be an object with keys array)
    jwks = document.get("jwks")
    if jwks is not None:
        if not isinstance(jwks, dict):
            raise CIMDValidationError("jwks must be an object")
        keys = jwks.get("keys")
        if not isinstance(keys, list):
            raise CIMDValidationError("jwks must contain a 'keys' array")


def _get_origin(url: str) -> str:
    """Extract the origin (scheme + host + port) from a URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _validate_optional_string_array(document: dict, field: str) -> None:
    """Validate that an optional field, if present, is an array of strings."""
    value = document.get(field)
    if value is not None:
        if not isinstance(value, list):
            raise CIMDValidationError(f"{field} must be an array")
        if not all(isinstance(item, str) for item in value):
            raise CIMDValidationError(f"{field} must contain only strings")


class CIMDClient:
    """
    Client for fetching OAuth Client ID Metadata Documents (CIMD).

    CIMD is defined in draft-ietf-oauth-client-id-metadata-document and provides
    a mechanism for dynamic client registration by hosting client metadata at
    the client_id URL itself.

    Security considerations:
    - Uses safe_urlopen() which blocks private/loopback IPs (SSRF protection)
    - Enforces HTTPS scheme (validated before this class is called)
    - Limits response size to 5KB per RFC recommendation
    - Sets reasonable timeout (15 seconds)
    """

    # RFC recommendation: 5KB max for metadata documents
    MAX_RESPONSE_SIZE = 5 * 1024

    # Timeout for HTTP requests in seconds
    TIMEOUT = 15

    def fetch_metadata(self, client_id_url: str) -> dict:
        """
        Fetch and return CIMD metadata document from the client_id URL.

        Args:
            client_id_url: The client_id URL which must be a valid HTTPS URL.
                           URL validation should be done before calling this method.

        Returns:
            Parsed JSON metadata document as a dictionary.

        Raises:
            CIMDFetchError: If the metadata cannot be fetched or is invalid.
        """
        try:
            response = safe_urlopen(
                client_id_url,
                timeout=self.TIMEOUT,
                headers={"Accept": "application/json"},
                allow_redirects=False,
            )
        except RestrictedIPAddress:
            logger.warning(
                "cimd.fetch.restricted-ip",
                extra={"client_id_url": client_id_url},
            )
            raise CIMDFetchError("Client ID URL resolves to restricted IP address")
        except Timeout:
            logger.warning(
                "cimd.fetch.timeout",
                extra={"client_id_url": client_id_url, "timeout": self.TIMEOUT},
            )
            raise CIMDFetchError("Timeout fetching client metadata document")
        except RequestsConnectionError as e:
            logger.warning(
                "cimd.fetch.connection-error",
                extra={"client_id_url": client_id_url, "error": str(e)},
            )
            raise CIMDFetchError("Connection error fetching client metadata document")

        # Check HTTP status code
        if response.status_code != 200:
            logger.warning(
                "cimd.fetch.http-error",
                extra={
                    "client_id_url": client_id_url,
                    "status_code": response.status_code,
                },
            )
            raise CIMDFetchError(f"HTTP {response.status_code} fetching client metadata document")

        # Verify content type is JSON
        content_type = response.headers.get("Content-Type", "")
        if not content_type.startswith("application/json"):
            logger.warning(
                "cimd.fetch.invalid-content-type",
                extra={
                    "client_id_url": client_id_url,
                    "content_type": content_type,
                },
            )
            raise CIMDFetchError(
                f"Invalid content type: expected application/json, got {content_type}"
            )

        # Read response with size limit
        body = safe_urlread(response)
        if len(body) > self.MAX_RESPONSE_SIZE:
            logger.warning(
                "cimd.fetch.response-too-large",
                extra={
                    "client_id_url": client_id_url,
                    "size": len(body),
                    "max_size": self.MAX_RESPONSE_SIZE,
                },
            )
            raise CIMDFetchError(
                f"Response too large: {len(body)} bytes exceeds {self.MAX_RESPONSE_SIZE} byte limit"
            )

        # Parse JSON
        try:
            metadata = orjson.loads(body)
        except orjson.JSONDecodeError as e:
            logger.warning(
                "cimd.fetch.invalid-json",
                extra={"client_id_url": client_id_url, "error": str(e)},
            )
            raise CIMDFetchError("Invalid JSON in client metadata document")

        if not isinstance(metadata, dict):
            logger.warning(
                "cimd.fetch.not-object",
                extra={"client_id_url": client_id_url, "type": type(metadata).__name__},
            )
            raise CIMDFetchError("Client metadata document must be a JSON object")

        return metadata
