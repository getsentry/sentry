from __future__ import absolute_import

from sentry_plugins.client import ApiClient


class PushoverClient(ApiClient):
    base_url = "https://api.pushover.net/1"
    allow_redirects = False
    plugin_name = "pushover"

    def __init__(self, userkey=None, apikey=None):
        self.userkey = userkey
        self.apikey = apikey
        super(PushoverClient, self).__init__()

    def request(self, method, path, data):
        # see https://pushover.net/api
        # We can no longer send JSON because pushover disabled incoming
        # JSON data: http://updates.pushover.net/post/39822700181/
        payload = {"user": self.userkey, "token": self.apikey}
        payload.update(data)
        return self._request(path=path, method=method, data=payload, json=False)

    def send_message(self, data):
        return self.request("POST", "/messages.json", data)
