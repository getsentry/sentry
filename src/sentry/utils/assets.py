from __future__ import absolute_import

import os
import posixpath

from django.conf import settings
from django.contrib.staticfiles import finders
from django.utils.six.moves.urllib.parse import unquote
from django.http import Http404


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


def resolve(path):
    # Mostly yanked from Django core and changed to return the path:
    # See: https://github.com/django/django/blob/1.6.11/django/contrib/staticfiles/views.py
    normalized_path = posixpath.normpath(unquote(path)).lstrip('/')
    try:
        absolute_path = finders.find(normalized_path)
    except Exception:
        # trying to access bad paths like, `../../etc/passwd`, etc that
        # Django rejects, but respond nicely instead of erroring.
        absolute_path = None
    if not absolute_path:
        raise Http404("'%s' could not be found" % path)
    if path[-1] == '/' or os.path.isdir(absolute_path):
        raise Http404('Directory indexes are not allowed here.')
    return os.path.split(absolute_path)
