"""
sentry.plugins.sentry_urls.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import sentry

from sentry.plugins import register
from sentry.plugins.bases.tag import TagPlugin


class UrlsPlugin(TagPlugin):
    """
    Automatically adds the 'url' tag from events containing interface data
    from ``sentry.interfaces.Http``.
    """
    slug = 'urls'
    title = 'Auto Tag: URLs'
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    tag = 'url'
    project_default_enabled = True

    def get_tag_values(self, event):
        http = event.interfaces.get('sentry.interfaces.Http')
        if not http:
            return []
        if not http.url:
            return []
        return [http.url]

register(UrlsPlugin)
