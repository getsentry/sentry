from __future__ import absolute_import

import sentry

from sentry.plugins.bases.tag import TagPlugin


class UrlsPlugin(TagPlugin):
    """
    Automatically adds the 'url' tag from events containing interface data
    from ``request``.
    """

    slug = "urls"
    title = "Auto Tag: URLs"
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    tag = "url"
    project_default_enabled = True

    def get_tag_values(self, event):
        http = event.interfaces.get("request")
        if not http:
            return []
        if not http.url:
            return []
        return [http.url]
