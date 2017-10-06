from __future__ import absolute_import, print_function

import logging

from sentry import features
from sentry.integrations.helper import PipelineHelper
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
        helper = PipelineHelper.get_for_request(
            request=request,
            provider_id=provider_id,
        )
        if not helper:
            logging.error('integration.setup-error')
            return self.redirect('/')

        try:
            return helper.current_step()
        except Exception:
            logging.exception('integration.setup-error')
            return helper.error('an internal error occurred')
