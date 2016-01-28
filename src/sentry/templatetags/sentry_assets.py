from __future__ import absolute_import

from django.conf import settings
from django.template import Library

from sentry import options
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

register = Library()


register.simple_tag(get_asset_url, name='asset_url')


@register.simple_tag
def absolute_asset_url(module, path):
    """
    Returns a versioned absolute asset URL (located within Sentry's static files).

    Example:
      {% absolute_asset_url 'sentry' 'dist/sentry.css' %}
      =>  "http://sentry.example.com/_static/74d127b78dc7daf2c51f/sentry/dist/sentry.css"
    """
    return absolute_uri(get_asset_url(module, path))


@register.simple_tag
def crossorigin():
    """
    Returns an additional crossorigin="anonymous" snippet for use in a <script> tag if
    our asset urls are from a different domain than the system.url-prefix.
    """
    if absolute_uri(settings.STATIC_URL).startswith(options.get('system.url-prefix')):
        # They share the same domain prefix, so we don't need CORS
        return ''
    return ' crossorigin="anonymous"'
