from django.http import HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import Integration
from sentry.utils.http import absolute_uri


class VercelConfigurationRedirect(Endpoint):

    authentication_classes = ()
    permission_classes = ()
    provider = "vercel"

    def get(self, request: Request) -> Response:
        configuration_id = request.query_params["configurationId"]
        integration = Integration.objects.get(
            provider=self.provider, metadata__contains=configuration_id
        )
        organizations = integration.organizations.all()
        return HttpResponseRedirect(
            absolute_uri(f"/settings/{organizations[0].slug}/integrations/{self.provider}/")
        )
