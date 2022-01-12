from urllib.parse import parse_qsl, urlparse

from django.http import HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Integration
from sentry.utils.http import absolute_uri

from .integration_extension_configuration import IntegrationExtensionConfigurationView


class VercelExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "vercel"
    external_provider_key = "vercel"

    def redirect(self, request: Request) -> Response:
        configuration_id = dict(parse_qsl(urlparse(request).query))["configurationId"]
        integration = Integration.objects.get(
            provider="vercel", metadata__contains=configuration_id
        )
        organizations = integration.organizations.all()
        return HttpResponseRedirect(
            absolute_uri(f"/settings/{organizations[0].slug}/integrations/vercel/")
        )
