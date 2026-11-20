from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from requests.exceptions import RequestException, SSLError

from sentry.http import safe_urlopen

from .constants import (
    ALLOWED_SIGNING_ALGORITHMS,
    DATA_VERSION,
    DISCOVERY_PATH,
    HTTP_TIMEOUT,
    SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
)


class DiscoveryError(Exception):
    """The provider's discovery document can't be fetched or isn't usable. The message is shown to the admin."""


def normalize_issuer(issuer: str) -> str:
    return issuer.strip().rstrip("/")


def is_https_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def fetch_discovery_document(issuer: str) -> dict[str, Any]:
    if not is_https_url(issuer):
        raise DiscoveryError("The issuer URL must start with https://.")

    url = normalize_issuer(issuer) + DISCOVERY_PATH
    try:
        response = safe_urlopen(url, timeout=HTTP_TIMEOUT)
    except SSLError:
        raise DiscoveryError(
            "Could not verify the SSL certificate of your identity provider."
        ) from None
    except RequestException:
        raise DiscoveryError(f"Could not reach {url}.") from None

    if response.status_code != 200:
        raise DiscoveryError(f"{url} returned HTTP {response.status_code}.")

    try:
        document = response.json()
    except ValueError:
        raise DiscoveryError(f"{url} did not return JSON.") from None

    if not isinstance(document, dict):
        raise DiscoveryError(f"{url} did not return a JSON object.")
    return document


def build_provider_config(
    issuer: str, document: dict[str, Any], client_id: str, client_secret: str
) -> dict[str, Any]:
    """
    Validate a discovery document (OpenID Connect Discovery 1.0 §3, §4.3) and turn it
    into the config stored on the AuthProvider. ``client_secret`` must already be encrypted.
    """
    discovered_issuer = document.get("issuer")
    # §4.3 requires an exact match. We only forgive a trailing slash, because admins
    # often paste the issuer with or without one.
    if not isinstance(discovered_issuer, str) or normalize_issuer(
        discovered_issuer
    ) != normalize_issuer(issuer):
        raise DiscoveryError(
            f"The discovery document's issuer ({discovered_issuer!r}) does not match the issuer URL you entered."
        )

    for field in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
        if not is_https_url(document.get(field)):
            raise DiscoveryError(f"The discovery document needs an https {field}.")

    response_types = document.get("response_types_supported") or []
    if "code" not in response_types:
        raise DiscoveryError("The provider does not support the authorization code flow.")

    signing_algs = sorted(
        ALLOWED_SIGNING_ALGORITHMS.intersection(
            document.get("id_token_signing_alg_values_supported") or []
        )
    )
    if not signing_algs:
        raise DiscoveryError(
            "The provider does not sign ID tokens with an asymmetric algorithm Sentry supports "
            "(RS*, PS* or ES*)."
        )

    # Discovery §3: an omitted value means client_secret_basic.
    auth_methods = document.get("token_endpoint_auth_methods_supported") or ["client_secret_basic"]
    auth_method = next(
        (m for m in SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS if m in auth_methods), None
    )
    if auth_method is None:
        raise DiscoveryError(
            "The provider does not support client_secret_basic or client_secret_post."
        )

    return {
        "version": DATA_VERSION,
        "issuer": discovered_issuer,
        "client_id": client_id,
        "client_secret": client_secret,
        "authorization_endpoint": document["authorization_endpoint"],
        "token_endpoint": document["token_endpoint"],
        "jwks_uri": document["jwks_uri"],
        "id_token_signing_alg_values_supported": signing_algs,
        "token_endpoint_auth_method": auth_method,
    }
