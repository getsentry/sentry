from __future__ import absolute_import, print_function

from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.integrations.pipeline import ensure_integration

from sentry.integrations import IntegrationProvider


class AtlassianConnectIntegrationProvider(IntegrationProvider):
    pass


class AtlassianConnectEndpoint(Endpoint):
    """
    Base for Atlassian Connect Endpoints as part of the Atlassian connect lifecycle.

    Apps must have an installed and uninstalled endpoint that Atlassian will call,
    giving information needed to install/uninstall the app.
    """

    def get_key(self):
        # Must be implemented by the inheriting app.
        raise NotImplementedError

    def get_integration_provider(self):
        # Must be implemented by the inheriting app.
        raise NotImplementedError


class AtlassianConnectInstalledEndpoint(AtlassianConnectEndpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(AtlassianConnectInstalledEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        state = request.DATA
        data = self.get_integration_provider().build_integration(state)
        ensure_integration(self.get_key(), data)

        return self.respond()


class AtlassianConnectUninstalledEndpoint(AtlassianConnectEndpoint):
    def post(self, request, *args, **kwargs):
        # TODO(LB): Having trouble figuring out what this does or even what
        # the input would be. Can't find it in docs. Check with Jess
        raise NotImplementedError
