from __future__ import absolute_import, print_function

import logging

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import BaseView

logger = logging.getLogger('sentry.integrations')


class IntegrationSetupView(BaseView):
    required_scope = 'org:integrations'

    csrf_protect = False

    def handle(self, request, provider_id):
        pipeline = IntegrationPipeline.get_for_request(request=request)
        if not pipeline:
            logging.error('integration.setup-error')
            return self.redirect('/')

        return pipeline.current_step()
