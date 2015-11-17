from __future__ import absolute_import

from django.conf import settings


def get_asset_url(module, path):
    """
    Returns a versioned asset URL (located within Sentry's static files).

    Example:
      {% asset_url 'sentry' 'dist/sentry.css' %}
      =>  "/_static/74d127b78dc7daf2c51f/sentry/dist/sentry.css"
    """
    return '{}/{}/{}'.format(
        settings.STATIC_URL.rstrip('/'),
        module,
        path,
    )
