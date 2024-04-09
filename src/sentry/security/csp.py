from __future__ import annotations

from urllib.parse import urlunsplit

from sentry.utils.urls import urlsplit_best_effort

LOCAL = "'self'"


def normalize_value(value: str) -> str:
    if value in ("", LOCAL, LOCAL.strip("'")):
        return LOCAL

    # A lot of these values get reported as literally
    # just the scheme. So a value like 'data' or 'blob', which
    # are valid schemes, just not a uri. So we want to
    # normalize it into a uri.
    if ":" not in value:
        scheme, hostname = value, ""
    else:
        scheme, hostname, _, _ = urlsplit_best_effort(value)
        if scheme in ("http", "https"):
            return hostname
    return urlunsplit((scheme, hostname, "", None, None))
