from __future__ import annotations

from urllib.parse import urlparse


def url_is_under(url: str, base: str) -> bool:
    """
    Whether `url` points below `base`, such as a file link below an instance or
    group URL.

    The host must match exactly and the path must continue past `base`'s path at a
    `/`, so `https://host/acme` does not claim `https://host/acme-mobile/...`. The
    scheme is ignored because it never tells two integrations apart, and a trailing
    slash on `base` is tolerated.

    A `base` without a host never matches. Without a scheme, `urlparse` reads
    `host/path` as a path alone, which would otherwise match any other such string.
    """
    parsed_base = urlparse(base)
    parsed_url = urlparse(url)
    return (
        bool(parsed_base.netloc)
        and parsed_url.netloc == parsed_base.netloc
        and parsed_url.path.startswith(parsed_base.path.rstrip("/") + "/")
    )
