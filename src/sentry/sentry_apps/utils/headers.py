from collections.abc import Mapping, Sequence

from sentry.sentry_apps.models.sentry_app import MASKED_VALUE

# HTTP/1.1 header field values are historically ISO-8859-1 (latin-1).
# Non-latin-1 characters (e.g. U+3000 ideographic space) cannot be sent
# and must be rejected as invalid configuration rather than crashing send.
_HTTP_HEADER_ENCODING = "latin-1"


def assert_http_header_value(value: str, *, field_name: str = "header") -> None:
    """Raise ValueError if ``value`` cannot be encoded as an HTTP header field.

    HTTP header names/values must be representable in latin-1. This is used both
    at write time (API validation) and at send time (defensive halt).
    """
    try:
        value.encode(_HTTP_HEADER_ENCODING)
    except UnicodeEncodeError as exc:
        raise ValueError(
            f"Webhook {field_name} contains non-latin-1 characters and cannot be "
            f"sent as an HTTP header."
        ) from exc


def validate_http_headers(headers: Mapping[str, str]) -> None:
    """Validate that every header name and value is latin-1 encodable."""
    for name, value in headers.items():
        assert_http_header_value(name, field_name="header name")
        assert_http_header_value(value, field_name="header value")


def parse_custom_headers(webhook_headers: Sequence[str]) -> dict[str, str]:
    headers: dict[str, str] = {}
    for header in webhook_headers:
        name, separator, value = header.partition(":")
        if separator:
            headers[name.strip()] = value.strip()
    return headers


def mask_header_values(headers: Mapping[str, str]) -> dict[str, str]:
    return {name: MASKED_VALUE for name in headers}
