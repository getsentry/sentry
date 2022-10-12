from django.conf import settings


def get_frontend_app_asset_url(module: str, key: str) -> str:
    """
    Returns an asset URL that is unversioned. These assets should have a
    `Cache-Control: max-age=0, must-revalidate` so that clients must validate with the origin
    server before using their locally cached asset.

    Example:
      {% frontend_app_asset_url 'sentry' 'sentry.css' %}
      =>  "/_static/dist/sentry/sentry.css"
    """
    args = (settings.STATIC_FRONTEND_APP_URL.rstrip("/"), module, key.lstrip("/"))

    return "{}/{}/{}".format(*args)


def get_asset_url(module: str, path: str) -> str:
    """
    Returns a versioned asset URL (located within Sentry's static files).

    Example:
    {% asset_url 'sentry' 'images/sentry.png' %}
    =>  "/_static/74d127b78dc7daf2c51f/sentry/sentry.png"
    """
    return "{}/{}/{}".format(settings.STATIC_URL.rstrip("/"), module, path.lstrip("/"))
