from __future__ import annotations

import logging

import orjson
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread

logger = logging.getLogger("sentry.oauth.cimd")


class CIMDFetchError(Exception):
    """Exception raised when CIMD metadata document cannot be fetched."""


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
