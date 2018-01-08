from __future__ import absolute_import, print_function

import logging

from sentry import features
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import OrganizationView

logger = logging.getLogger('sentry.integrations')


class OrganizationIntegrationSetupView(OrganizationView):
    required_scope = 'org:integrations'

    csrf_protect = False

    def has_feature(self, request, organization):
        return features.has(
            'organizations:integrations-v3',
            organization=organization,
            actor=request.user,
        )

    def handle(self, request, organization, provider_id):
        if not self.has_feature(request, organization):
            return self.redirect('/')
        pipeline = IntegrationPipeline(
            request=request,
            organization=organization,
            provider_key=provider_id,
        )
        pipeline.initialize()

        return pipeline.current_step()
