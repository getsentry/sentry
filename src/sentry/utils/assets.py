from __future__ import annotations

import os.path

from cachetools.func import ttl_cache
from django.conf import settings

from sentry.utils import json


@ttl_cache(ttl=60)
def _frontend_versions() -> dict[str, str]:
    try:
        with open(
            os.path.join(settings.CONF_DIR, "settings", "frontend", "frontend-versions.json")
        ) as f:
            return json.load(f)  # type: ignore[no-any-return]  # getsentry path
    except OSError:
        return {}  # common case for self-hosted


def get_frontend_app_asset_url(module: str, key: str) -> str:
    """
    Returns an asset URL that is unversioned. These assets should have a
    `Cache-Control: max-age=0, must-revalidate` so that clients must validate with the origin
    server before using their locally cached asset.

    Example:
      {% frontend_app_asset_url 'sentry' 'entrypoints/sentry.css' %}
      =>  "/_static/dist/sentry/entrypoints/sentry.css"
    """
    if not key.startswith("entrypoints/"):
        raise AssertionError(f"unexpected key: {key}")

    entrypoints, key = key.split("/", 1)
    versions = _frontend_versions()
    if versions:
        entrypoints = "entrypoints-hashed"
        key = versions[key]

    return "/".join(
        (
            settings.STATIC_FRONTEND_APP_URL.rstrip("/"),
            module,
            entrypoints,
            key,
        )
    )


def get_frontend_dist_prefix() -> str:
    return f"{settings.STATIC_FRONTEND_APP_URL.rstrip('/')}/sentry/"


def get_asset_url(module: str, path: str) -> str:
    """
    Returns a versioned asset URL (located within Sentry's static files).

    Example:
    {% asset_url 'sentry' 'images/sentry.png' %}
    =>  "/_static/74d127b78dc7daf2c51f/sentry/images/sentry.png"
    """
    return "{}/{}/{}".format(settings.STATIC_URL.rstrip("/"), module, path.lstrip("/"))
