from __future__ import annotations

import hashlib
import logging
import re
from urllib.parse import urlparse

import orjson
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger("sentry.oauth.cimd")


class CIMDError(Exception):
    """Base exception for CIMD-related errors.

    All CIMD exceptions provide a safe_message property that can be shown
    to users without leaking sensitive information about the client or error.
    """

    def __init__(self, message: str, client_id_url: str | None = None):
        super().__init__(message)
        self.client_id_url = client_id_url

    def get_safe_hostname(self) -> str:
        """Extract hostname from client_id URL for safe user display.

        Per RFC, if metadata fetch fails, display only the client_id hostname
        to the user (don't show potentially spoofed metadata).
        """
        if not self.client_id_url:
            return "unknown"
        return urlparse(self.client_id_url).hostname or "unknown"

    @property
    def safe_message(self) -> str:
        """A user-safe error message that doesn't leak internal details."""
        hostname = self.get_safe_hostname()
        return f"Unable to verify client: {hostname}"


class CIMDFetchError(CIMDError):
    """Exception raised when CIMD metadata document cannot be fetched.

    This includes network errors, timeouts, HTTP errors, invalid content types,
    and response size limits.
    """


class CIMDValidationError(CIMDError):
    """Exception raised when CIMD metadata document fails validation.

    This includes client_id mismatches, prohibited fields, invalid auth methods,
    and redirect_uri validation failures.
    """


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
        raise CIMDValidationError("Missing required field: client_id", client_id_url)

    if client_id != client_id_url:
        raise CIMDValidationError(
            f"client_id mismatch: document contains '{client_id}' but was fetched from '{client_id_url}'",
            client_id_url,
        )

    # 2. Prohibited fields MUST NOT appear
    for field in PROHIBITED_FIELDS:
        if field in document:
            raise CIMDValidationError(f"Prohibited field present: {field}", client_id_url)

    # 3. token_endpoint_auth_method validation
    auth_method = document.get("token_endpoint_auth_method")
    if auth_method is not None and auth_method not in VALID_AUTH_METHODS:
        # Provide specific error for prohibited methods (require client secrets)
        if auth_method in PROHIBITED_AUTH_METHODS:
            raise CIMDValidationError(
                f"Prohibited authentication method: {auth_method}", client_id_url
            )
        raise CIMDValidationError(f"Invalid authentication method: {auth_method}", client_id_url)

    # 4. redirect_uris validation
    redirect_uris = document.get("redirect_uris")
    if redirect_uris is not None:
        if not isinstance(redirect_uris, list):
            raise CIMDValidationError("redirect_uris must be an array", client_id_url)

        if not all(isinstance(uri, str) for uri in redirect_uris):
            raise CIMDValidationError("redirect_uris must contain only strings", client_id_url)

        # Validate redirect_uri origins match client_id origin (Sentry policy)
        client_origin = _get_origin(client_id_url)
        for uri in redirect_uris:
            redirect_origin = _get_origin(uri)
            if redirect_origin != client_origin:
                raise CIMDValidationError(
                    f"redirect_uri origin '{redirect_origin}' does not match client_id origin '{client_origin}'",
                    client_id_url,
                )

    # 5. Optional field type validation
    _validate_optional_string_array(document, "grant_types", client_id_url)
    _validate_optional_string_array(document, "response_types", client_id_url)

    # 6. jwks_uri validation (if present, must be a valid HTTPS URL)
    jwks_uri = document.get("jwks_uri")
    if jwks_uri is not None:
        if not isinstance(jwks_uri, str):
            raise CIMDValidationError("jwks_uri must be a string", client_id_url)
        if urlparse(jwks_uri).scheme != "https":
            raise CIMDValidationError("jwks_uri must use HTTPS", client_id_url)

    # 7. jwks validation (if present, must be an object with keys array)
    jwks = document.get("jwks")
    if jwks is not None:
        if not isinstance(jwks, dict):
            raise CIMDValidationError("jwks must be an object", client_id_url)
        keys = jwks.get("keys")
        if not isinstance(keys, list):
            raise CIMDValidationError("jwks must contain a 'keys' array", client_id_url)


def _get_origin(url: str) -> str:
    """Extract the origin (scheme + host + port) from a URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _validate_optional_string_array(
    document: dict, field: str, client_id_url: str | None = None
) -> None:
    """Validate that an optional field, if present, is an array of strings."""
    value = document.get(field)
    if value is not None:
        if not isinstance(value, list):
            raise CIMDValidationError(f"{field} must be an array", client_id_url)
        if not all(isinstance(item, str) for item in value):
            raise CIMDValidationError(f"{field} must contain only strings", client_id_url)


class CIMDCache:
    """
    Caching layer for CIMD metadata documents.

    Per RFC, authorization servers SHOULD respect HTTP cache headers and MAY
    define custom cache lifetime bounds. This implementation:
    - Caches validated metadata documents keyed by URL hash
    - Respects HTTP Cache-Control max-age directive
    - Enforces upper/lower TTL bounds for security
    - Never caches error responses or invalid documents
    """

    # Cache TTL bounds in seconds
    DEFAULT_TTL = 900  # 15 minutes
    MAX_TTL = 3600  # 1 hour (upper bound per RFC guidance)
    MIN_TTL = 60  # 1 minute (prevent hammering)

    CACHE_KEY_PREFIX = "cimd:metadata"

    def get_cache_key(self, client_id_url: str) -> str:
        """Generate a cache key from the client_id URL."""
        url_hash = hashlib.sha256(client_id_url.encode()).hexdigest()[:32]
        return f"{self.CACHE_KEY_PREFIX}:{url_hash}"

    def get(self, client_id_url: str) -> dict | None:
        """
        Retrieve cached CIMD metadata for a client_id URL.

        Args:
            client_id_url: The client_id URL to look up.

        Returns:
            Cached metadata dictionary, or None if not cached.
        """
        key = self.get_cache_key(client_id_url)
        return cache.get(key)

    def set(self, client_id_url: str, metadata: dict, cache_control: str | None = None) -> None:
        """
        Cache validated CIMD metadata.

        Args:
            client_id_url: The client_id URL the metadata was fetched from.
            metadata: The validated metadata document.
            cache_control: HTTP Cache-Control header value from the response.
        """
        key = self.get_cache_key(client_id_url)
        ttl = self._calculate_ttl(cache_control)
        cache.set(key, metadata, ttl)
        logger.debug(
            "cimd.cache.set",
            extra={
                "client_id_url": client_id_url,
                "ttl": ttl,
                "cache_control": cache_control,
            },
        )

    def delete(self, client_id_url: str) -> None:
        """Remove cached metadata for a client_id URL."""
        key = self.get_cache_key(client_id_url)
        cache.delete(key)

    def _calculate_ttl(self, cache_control: str | None) -> int:
        """
        Calculate TTL from Cache-Control header, applying bounds.

        Parses the max-age directive from Cache-Control and clamps it
        between MIN_TTL and MAX_TTL.

        Args:
            cache_control: HTTP Cache-Control header value, or None.

        Returns:
            TTL in seconds, bounded by MIN_TTL and MAX_TTL.
        """
        ttl = self.DEFAULT_TTL

        if cache_control:
            # Parse max-age directive (e.g., "max-age=3600" or "public, max-age=600")
            match = re.search(r"max-age=(\d+)", cache_control, re.IGNORECASE)
            if match:
                ttl = int(match.group(1))

        return max(self.MIN_TTL, min(ttl, self.MAX_TTL))


# Module-level cache instance for convenience
cimd_cache = CIMDCache()


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

    def __init__(self, cache: CIMDCache | None = None):
        """
        Initialize the CIMD client.

        Args:
            cache: Optional cache instance. If not provided, uses the module-level
                   cimd_cache instance.
        """
        self._cache = cache if cache is not None else cimd_cache

    def fetch_and_validate(self, client_id_url: str, *, skip_cache: bool = False) -> dict:
        """
        Fetch, validate, and cache CIMD metadata document.

        This is the primary method for retrieving CIMD metadata. It:
        1. Checks the cache for existing valid metadata
        2. If not cached, fetches from the client_id URL
        3. Validates the document per RFC requirements
        4. Caches valid metadata respecting HTTP Cache-Control headers

        Args:
            client_id_url: The client_id URL which must be a valid HTTPS URL.
            skip_cache: If True, bypasses cache lookup (but still caches results).

        Returns:
            Validated metadata document as a dictionary.

        Raises:
            CIMDFetchError: If the metadata cannot be fetched.
            CIMDValidationError: If the metadata fails validation.
        """
        # Check cache first (unless explicitly skipped)
        if not skip_cache:
            cached = self._cache.get(client_id_url)
            if cached is not None:
                logger.debug(
                    "cimd.cache.hit",
                    extra={"client_id_url": client_id_url},
                )
                metrics.incr("oauth.cimd.cache.hit", sample_rate=1.0)
                return cached

        # Fetch and parse (cache miss)
        metrics.incr("oauth.cimd.cache.miss", sample_rate=1.0)
        metadata, cache_control = self._fetch_metadata_with_headers(client_id_url)

        # Validate (may raise CIMDValidationError)
        validate_cimd_document(metadata, client_id_url)

        # Cache valid metadata
        self._cache.set(client_id_url, metadata, cache_control)

        return metadata

    def _fetch_metadata_with_headers(self, client_id_url: str) -> tuple[dict, str | None]:
        """
        Fetch CIMD metadata and return it along with Cache-Control header.

        Returns:
            Tuple of (metadata dict, Cache-Control header value or None).
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
            raise CIMDFetchError("Client ID URL resolves to restricted IP address", client_id_url)
        except Timeout:
            logger.warning(
                "cimd.fetch.timeout",
                extra={"client_id_url": client_id_url, "timeout": self.TIMEOUT},
            )
            raise CIMDFetchError("Timeout fetching client metadata document", client_id_url)
        except RequestsConnectionError as e:
            logger.warning(
                "cimd.fetch.connection-error",
                extra={"client_id_url": client_id_url, "error": str(e)},
            )
            raise CIMDFetchError(
                "Connection error fetching client metadata document", client_id_url
            )

        # Check HTTP status code
        if response.status_code != 200:
            logger.warning(
                "cimd.fetch.http-error",
                extra={
                    "client_id_url": client_id_url,
                    "status_code": response.status_code,
                },
            )
            raise CIMDFetchError(
                f"HTTP {response.status_code} fetching client metadata document", client_id_url
            )

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
                f"Invalid content type: expected application/json, got {content_type}",
                client_id_url,
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
                f"Response too large: {len(body)} bytes exceeds {self.MAX_RESPONSE_SIZE} byte limit",
                client_id_url,
            )

        # Parse JSON
        try:
            metadata = orjson.loads(body)
        except orjson.JSONDecodeError as e:
            logger.warning(
                "cimd.fetch.invalid-json",
                extra={"client_id_url": client_id_url, "error": str(e)},
            )
            raise CIMDFetchError("Invalid JSON in client metadata document", client_id_url)

        if not isinstance(metadata, dict):
            logger.warning(
                "cimd.fetch.not-object",
                extra={"client_id_url": client_id_url, "type": type(metadata).__name__},
            )
            raise CIMDFetchError("Client metadata document must be a JSON object", client_id_url)

        # Extract Cache-Control header for caching
        cache_control = response.headers.get("Cache-Control")

        return metadata, cache_control

    def fetch_metadata(self, client_id_url: str) -> dict:
        """
        Fetch and return CIMD metadata document from the client_id URL.

        This method fetches without caching or validation. For most use cases,
        prefer `fetch_and_validate()` which includes caching and validation.

        Args:
            client_id_url: The client_id URL which must be a valid HTTPS URL.
                           URL validation should be done before calling this method.

        Returns:
            Parsed JSON metadata document as a dictionary.

        Raises:
            CIMDFetchError: If the metadata cannot be fetched or is invalid.
        """
        metadata, _ = self._fetch_metadata_with_headers(client_id_url)
        return metadata
