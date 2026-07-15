from __future__ import annotations

from requests import HTTPError, RequestException

from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.datadog.provider import DatadogWhoami, mcp_base_url_for_site, mcp_whoami
from sentry.shared_integrations.exceptions import IntegrationConfigurationError


def validate_datadog_credentials(api_key: str, app_key: str, site: str) -> DatadogWhoami:
    """Validate Datadog API + application keys.

    Returns the whoami payload on success, or raises ``IntegrationConfigurationError``
    if the site or credentials are invalid.
    """
    base_url = mcp_base_url_for_site(site)
    if base_url is None:
        raise IntegrationConfigurationError(f"Invalid Datadog site: {site}")

    headers = {"DD-API-KEY": api_key, "DD-APPLICATION-KEY": app_key}
    try:
        user = mcp_whoami(base_url, headers)
    except HTTPError as e:
        status = e.response.status_code if e.response is not None else None
        if status in (401, 403):
            raise IntegrationConfigurationError(
                "Invalid Datadog API or application key. Check that both are correct and active."
            )
        raise IntegrationConfigurationError(
            "Unable to validate Datadog credentials. Please try again."
        )
    except RequestException:
        raise IntegrationConfigurationError(
            "Could not reach Datadog to validate credentials. Please try again."
        )
    except IdentityNotValid:
        raise IntegrationConfigurationError(
            "Datadog returned an unexpected response while validating credentials."
        )

    if "user_uuid" not in user or "org_uuid" not in user:
        raise IntegrationConfigurationError(
            "Datadog credentials are missing expected user/organization info; "
            "check the application key."
        )
    return user
