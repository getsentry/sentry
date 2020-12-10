from __future__ import absolute_import

from sentry_plugins.client import InternalApiClient


class HerokuApiClient(InternalApiClient):
    plugin_name = "heroku"

    def __init__(self):
        super(HerokuApiClient, self).__init__()
