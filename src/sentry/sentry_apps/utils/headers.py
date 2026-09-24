from collections.abc import Mapping, Sequence

from sentry.sentry_apps.models.sentry_app import MASKED_VALUE


def parse_custom_headers(webhook_headers: Sequence[str]) -> dict[str, str]:
    headers: dict[str, str] = {}
    for header in webhook_headers:
        name, separator, value = header.partition(":")
        if separator:
            headers[name.strip()] = value.strip()
    return headers


def mask_header_values(headers: Mapping[str, str]) -> dict[str, str]:
    return {name: MASKED_VALUE for name in headers}


def mask_signature_headers(headers: Mapping[str, str]) -> dict[str, str]:
    """Remove replayable webhook signatures from request logs."""
    return {
        name: MASKED_VALUE
        if name.lower() in {"sentry-hook-signature", "sentry-app-signature"}
        else value
        for name, value in headers.items()
    }
