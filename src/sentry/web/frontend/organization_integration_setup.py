import logging

from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import OrganizationView

logger = logging.getLogger("sentry.integrations")


class OrganizationIntegrationSetupView(OrganizationView):
    required_scope = "org:integrations"

    csrf_protect = False

    def handle(self, request: Request, organization, provider_id) -> Response:
        pipeline = IntegrationPipeline(
            request=request, organization=organization, provider_key=provider_id
        )

        if not pipeline.provider.can_add:
            raise Http404

        pipeline.initialize()

        return pipeline.current_step()
