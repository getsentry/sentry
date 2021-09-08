from django.conf import settings
from manifest_loader.utils import _get_manifest, _load_from_manifest


def get_manifest_obj():
    """
    Returns the webpack asset manifest as a dict of <file key, hashed file name>

    The `manifest_loader` library caches this (if `cache` settings is set)
    """
    return _get_manifest()


def get_frontend_app_asset_url(module, key, cache_bust=False):
    """
    Returns an asset URL that is produced by webpack. Uses webpack's manifest to map
    `key` to the asset produced by webpack. Required if using file contents based hashing for filenames.

    XXX(epurkhiser): As a temporary workaround for flakeyness with the CDN,
    we're busting caches when version_bust is True using a query parameter with
    the currently deployed backend SHA. This will have to change in the future
    for frontend only deploys.

    Example:
      {% frontend_app_asset_url 'sentry' 'sentry.css' %}
      =>  "/_static/dist/sentry/sentry.css"

      {% frontend_app_asset_url 'sentry' 'sentry.css' cache_bust=True %}
      =>  "/_static/dist/sentry/sentry.css?v=xxx"
    """
    manifest_obj = get_manifest_obj()
    manifest_value = _load_from_manifest(manifest_obj, key=key)
    args = (settings.STATIC_FRONTEND_APP_URL.rstrip("/"), module, manifest_value)

    if not cache_bust:
        return "{}/{}/{}".format(*args)
    return "{}/{}/{}?v={}".format(*args, settings.SENTRY_SDK_CONFIG["release"])


def get_asset_url(module, path):
    """
    Returns a versioned asset URL (located within Sentry's static files).

    Example:
      {% asset_url 'sentry' 'images/sentry.png' %}
      =>  "/_static/74d127b78dc7daf2c51f/sentry/sentry.png"
    """
    return "{}/{}/{}".format(settings.STATIC_URL.rstrip("/"), module, path.lstrip("/"))
