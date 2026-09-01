from __future__ import annotations

import orjson
from requests import HTTPError, RequestException

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

DATADOG_VALID_SITES: dict[str, str] = {
    "datadoghq.com": "US1",
    "us3.datadoghq.com": "US3",
    "us5.datadoghq.com": "US5",
    "datadoghq.eu": "EU",
    "ap1.datadoghq.com": "AP1",
    "ap2.datadoghq.com": "AP2",
    "ddog-gov.com": "US1-FED",
    "us2.ddog-gov.com": "US2-FED",
}


def api_base_url_for_site(site: str | None) -> str | None:
    """Validated Datadog REST API base URL for a site, or None if it's missing/invalid."""
    if not site or site not in DATADOG_VALID_SITES:
        return None
    return f"https://api.{site}"


def validate_datadog_credentials(api_key: str, app_key: str, site: str) -> str:
    """Validate Datadog API + application keys.

    Returns the Datadog organization UUID on success, or raises
    ``IntegrationConfigurationError`` if the site or credentials are invalid.
    """
    base_url = api_base_url_for_site(site)
    if base_url is None:
        raise IntegrationConfigurationError(f"Invalid Datadog site: {site}")

    headers = {
        "DD-API-KEY": api_key,
        "DD-APPLICATION-KEY": app_key,
        "Accept": "application/json",
    }
    try:
        resp = safe_urlopen(f"{base_url}/api/v2/current_user", method="GET", headers=headers)
        resp.raise_for_status()
    except HTTPError as e:
        status = e.response.status_code if e.response is not None else None
        if status in (401, 403):
            raise IntegrationConfigurationError(
                "Invalid Datadog API or application key. Check that both are correct and active."
            )
        raise IntegrationConfigurationError(
            "Unable to validate Datadog credentials. Please try again."
        )
    except (RestrictedIPAddress, RequestException):
        raise IntegrationConfigurationError(
            "Could not reach Datadog to validate credentials. Please try again."
        )

    try:
        body = orjson.loads(safe_urlread(resp))
        return body["data"]["relationships"]["org"]["data"]["id"]
    except (KeyError, IndexError, TypeError, orjson.JSONDecodeError):
        raise IntegrationConfigurationError(
            "Datadog returned an unexpected response while validating credentials."
        )
