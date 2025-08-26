from __future__ import annotations

import os.path
from dataclasses import dataclass

from cachetools.func import ttl_cache
from django.conf import settings

from sentry.utils import json


@dataclass
class FrontendVersions:
    commit_sha: str | None
    """
    The commit SHA of the currently deployed frontend version.

    XXX(epuirkhiser): currently may be None while we transition to a
    frontend-versions file that contains the version_sha.
    """
    entrypoints: dict[str, str]
    """
    A mapping of unversioned entrypoint names to versioned entrypoints,
    containing a content-hash suffix.
    """


@ttl_cache(ttl=60)
def _frontend_versions() -> FrontendVersions | None:
    config = os.path.join(settings.CONF_DIR, "settings", "frontend", "frontend-versions.json")
    try:
        with open(config) as f:
            contents = json.load(f)  # getsentry path
    except OSError:
        return None  # common case for self-hosted

    # XXX(epurkhiser): Shim code while we transition to a
    # `frontend-versions.json` file that contains both a webpack entrypoint
    # mapping as well as a commit SHA.
    if "commit_sha" not in contents:
        return FrontendVersions(commit_sha=None, entrypoints=contents)

    return FrontendVersions(**contents)


def get_frontend_commit_sha() -> str | None:
    """
    Returns the commit SHA of the currently configured frontend-versions.
    """
    if versions := _frontend_versions():
        return versions.commit_sha
    return None


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

    asset_path, key = key.split("/", 1)
    versions = _frontend_versions()

    # When a frontend entrypoint versions config is provided use to map the
    # asset file to a hashed entrypoint
    if versions:
        asset_path = "entrypoints-hashed"
        key = versions.entrypoints[key]

    return "/".join(
        (
            settings.STATIC_FRONTEND_APP_URL.rstrip("/"),
            module,
            asset_path,
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
