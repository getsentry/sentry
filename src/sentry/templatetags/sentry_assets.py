from __future__ import absolute_import

from django.conf import settings
from django.core.urlresolvers import reverse
from django.template import Library

register = Library()


@register.simple_tag
def asset_url(module, path):
    """
    Returns a versioned asset URL (located within Sentry's static files).

    Example:
      {% asset_url 'sentry' 'dist/sentry.css' %}
      =>  "/_static/74d127b78dc7daf2c51f/sentry/dist/sentry.css"
    """
    return reverse('sentry-media', kwargs={
        'version': settings.ASSET_VERSION,
        'module': module,
        'path': path,
    })
