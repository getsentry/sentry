from __future__ import absolute_import, print_function

import logging

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import OrganizationView

logger = logging.getLogger('sentry.integrations')


class IntegrationSetupView(OrganizationView):
    required_scope = 'org:integrations'

    csrf_protect = False

    def handle(self, request, organization, provider_id):
        pipeline = IntegrationPipeline.get_for_request(request=request)
        if not pipeline:
            logging.error('integration.setup-error')
            return self.redirect('/')

        return pipeline.current_step()
