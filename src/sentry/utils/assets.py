from django.conf import settings
from manifest_loader.utils import _get_manifest, _load_from_manifest


def get_manifest_obj():
    """
    Returns the webpack asset manifest as a dict of <file key, hashed file name>

    The `manifest_loader` library caches this (if `cache` settings is set)
    """
    return _get_manifest()


def get_manifest_url(module, key):
    """
    Returns an asset URL that is produced by webpack. Uses webpack's manifest to map
    `key` to the asset produced by webpack. Required if using file contents based hashing for filenames.

    Example:
      {% manifest_asset_url 'sentry' 'sentry.css' %}
      =>  "/_static/dist/sentry/sentry.filehash123.css"
    """
    manifest_obj = get_manifest_obj()
    manifest_value = _load_from_manifest(manifest_obj, key=key)

    return "{}/{}/{}".format(settings.STATIC_MANIFEST_URL.rstrip("/"), module, manifest_value)


def get_asset_url(module, path):
    """
    Returns a versioned asset URL (located within Sentry's static files).

    Example:
      {% asset_url 'sentry' 'images/sentry.png' %}
      =>  "/_static/74d127b78dc7daf2c51f/sentry/sentry.png"
    """
    return "{}/{}/{}".format(settings.STATIC_URL.rstrip("/"), module, path.lstrip("/"))
