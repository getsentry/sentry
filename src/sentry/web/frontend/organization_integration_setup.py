import logging

from django.http import Http404

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import OrganizationView

logger = logging.getLogger("sentry.integrations")


class OrganizationIntegrationSetupView(OrganizationView):
    required_scope = "org:integrations"

    csrf_protect = False

    def handle(self, request, organization, provider_id):
        pipeline = IntegrationPipeline(
            request=request, organization=organization, provider_key=provider_id
        )

        if not pipeline.provider.can_add:
            raise Http404

        pipeline.initialize()

        return pipeline.current_step()
