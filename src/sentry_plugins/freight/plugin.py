from __future__ import absolute_import

import sentry
from sentry.utils import json
from sentry.plugins.bases import ReleaseTrackingPlugin
from sentry.plugins.interfaces.releasehook import ReleaseHook


DOC_HTML = u"""
<p>Configure a Freight notification with the given webhook url.</p>
<pre class="clippy">{{
    "type": "sentry",
    "config": {{"webhook_url": "{hook_url}"}}
}}</pre>
"""


class FreightReleaseHook(ReleaseHook):
    def handle(self, request):
        data = json.loads(request.body)
        if data["event"] == "started":
            self.start_release(version=data["sha"], ref=data["ref"], url=data["link"])
        elif data["event"] == "finished":
            self.finish_release(version=data["sha"], ref=data["ref"], url=data["link"])
        else:
            raise ValueError(data["event"])


class FreightPlugin(ReleaseTrackingPlugin):
    author = "Sentry Team"
    author_url = "https://github.com/getsentry"

    title = "Freight"
    slug = "freight"
    description = "Integrate Freight release tracking."
    version = sentry.VERSION

    def has_plugin_conf(self):
        return True

    def get_release_doc_html(self, hook_url):
        return DOC_HTML.format(hook_url=hook_url)

    def get_release_hook(self):
        return FreightReleaseHook
