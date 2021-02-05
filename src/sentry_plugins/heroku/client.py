from sentry_plugins.client import InternalApiClient


class HerokuApiClient(InternalApiClient):
    plugin_name = "heroku"

    def __init__(self):
        super().__init__()
