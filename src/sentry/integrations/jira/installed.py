from __future__ import absolute_import


from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.integrations.pipeline import ensure_integration

from .integration import JiraIntegrationProvider


class JiraInstalledEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(JiraInstalledEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        state = request.DATA
        data = JiraIntegrationProvider().build_integration(state)
        ensure_integration('jira', data)

        return self.respond()
