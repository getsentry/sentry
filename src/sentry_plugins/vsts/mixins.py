import logging

from sentry.exceptions import PluginError
from sentry.shared_integrations.constants import ERR_UNAUTHORIZED
from sentry_plugins.base import CorePluginMixin

from .client import VstsClient


class VisualStudioMixin(CorePluginMixin):
    logger = logging.getLogger("sentry.plugins.visualstudio")
    title = "Visual Studio Team Services"
    short_title = "VSTS"

    def get_client(self, user):
        auth = self.get_auth(user=user)
        if auth is None:
            raise PluginError(ERR_UNAUTHORIZED)
        return VstsClient(auth)

    def get_title(self):
        return self.title

    def get_short_title(self):
        return self.short_title
