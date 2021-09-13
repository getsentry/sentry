from django.conf import settings


def get_frontend_app_asset_url(module, key, cache_bust=False):
    """
    Returns an asset URL that is unversioned. These assets should have a
    `Cache-Control: max-age=0, must-revalidate` so that clients must validate with the origin
    server before using their locally cached asset.

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
    args = (settings.STATIC_FRONTEND_APP_URL.rstrip("/"), module, key.lstrip("/"))

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
