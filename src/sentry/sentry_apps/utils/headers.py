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
