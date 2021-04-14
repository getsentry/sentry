from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.integrations.pipeline import ensure_integration
from sentry.tasks.integrations import sync_metadata

from .integration import JiraIntegrationProvider


class JiraInstalledEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        state = request.data
        data = JiraIntegrationProvider().build_integration(state)
        integration = ensure_integration("jira", data)

        # Sync integration metadata from Jira. This msut be executed *after*
        # the integration has been installed on Jira as the access tokens will
        # not work until then.
        sync_metadata.apply_async(kwargs={"integration_id": integration.id}, countdown=10)

        return self.respond()
