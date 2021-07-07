from django.conf import settings


def get_unversioned_asset_url(module, key):
    """
    Returns an asset URL that is unversioned. These assets should have a
    `Cache-Control: max-age=0, must-revalidate` so that clients must validate with the origin
    server before using their locally cached asset.

    Example:
      {% unversioned_asset_url 'sentry' 'sentry.css' %}
      =>  "/_static/dist/sentry/sentry.css"
    """

    return "{}/{}/{}".format(settings.STATIC_UNVERSIONED_URL.rstrip("/"), module, key.lstrip("/"))


def get_asset_url(module, path):
    """
    Returns a versioned asset URL (located within Sentry's static files).

    Example:
    {% asset_url 'sentry' 'images/sentry.png' %}
    =>  "/_static/74d127b78dc7daf2c51f/sentry/sentry.png"
    """
    return "{}/{}/{}".format(settings.STATIC_URL.rstrip("/"), module, path.lstrip("/"))
