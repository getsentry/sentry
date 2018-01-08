from __future__ import absolute_import, print_function

import logging

from sentry import features
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import BaseView

logger = logging.getLogger('sentry.integrations')


class IntegrationSetupView(BaseView):
    csrf_protect = False

    def has_feature(self, request, organization):
        return features.has(
            'organizations:integrations-v3',
            organization=organization,
            actor=request.user,
        )

    def handle(self, request, provider_id):
        pipeline = IntegrationPipeline.get_for_request(request=request)
        if not pipeline:
            logging.error('integration.setup-error')
            return self.redirect('/')

        try:
            return pipeline.current_step()
        except Exception:
            logging.exception('integration.setup-error')
            return pipeline.error('an internal error occurred')
