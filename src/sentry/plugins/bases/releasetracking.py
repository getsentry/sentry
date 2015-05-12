from __future__ import absolute_import

from sentry.plugins import Plugin2


class ReleaseTrackingPlugin(Plugin2):
    def get_release_doc_html(self, hook_url):
        raise NotImplementedError
