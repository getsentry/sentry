from __future__ import absolute_import

from time import time

from sentry.shared_integrations.client import BaseApiClient
from sentry.exceptions import InvalidIdentity


class ApiClient(BaseApiClient):
    integration_type = "integration"

    datadog_prefix = "integrations"

    log_path = "sentry.integrations.client"

    # Used in metrics and logging.
    integration_name = "undefined"


class OAuth2RefreshMixin(object):
    def check_auth(self, *args, **kwargs):
        """
        Checks if auth is expired and if so refreshes it
        """
        time_expires = self.identity.data.get("expires")
        if time_expires is None:
            raise InvalidIdentity("OAuth2ApiClient requires identity with specified expired time")
        if int(time_expires) <= int(time()):
            self.identity.get_provider().refresh_identity(self.identity, *args, **kwargs)
