from __future__ import annotations

from urllib.parse import urlparse

from sentry.exceptions import RestrictedIPAddress
from sentry.net.socket import is_safe_hostname


def validate_webhook_url(url: str | None) -> bool:
    """
    Validates that a webhook URL does not resolve to a restricted IP address.

    Args:
        url: The webhook URL to validate

    Returns:
        True if the URL is valid or None

    Raises:
        RestrictedIPAddress: If the URL resolves to a restricted IP address
    """
    if not url:
        return True

    hostname = urlparse(url).hostname
    if not is_safe_hostname(hostname):
        raise RestrictedIPAddress(
            f"Webhook URL '{url}' resolves to a restricted IP address. "
            "Please use a different webhook URL."
        )

    return True
