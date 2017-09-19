from __future__ import absolute_import, print_function

import logging

from sentry import features
from sentry.integrations.helper import PipelineHelper
from sentry.web.frontend.base import OrganizationView

logger = logging.getLogger('sentry.integrations')


class IntegrationSetupView(OrganizationView):
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

        if request.GET.get('init') != '1':
            helper = PipelineHelper.get_for_request(
                request=request,
                organization=organization,
                provider_id=provider_id,
            )
        else:
            helper = None

        if helper:
            try:
                return helper.current_step()
            except Exception:
                logging.exception('integration.setup-error')
                return helper.error('an internal error occurred')

        helper = PipelineHelper.initialize(
            request=request,
            organization=organization,
            provider_id=provider_id,
            dialog=True,
        )
        # we redirect the user to scrub parameters from the URL to avoid passing
        # them into third parties
        return self.redirect(request.path)
