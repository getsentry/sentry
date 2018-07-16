from __future__ import absolute_import, print_function

import logging

from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import BaseView

logger = logging.getLogger('sentry.integrations')


class IntegrationSetupView(BaseView):
    auth_required = False

    csrf_protect = False

    def handle(self, request, provider_id):
        pipeline = IntegrationPipeline.get_for_request(request=request)
        if not pipeline:
            pipeline = IdentityProviderPipeline.get_for_request(request=request)

        if pipeline is None or not pipeline.is_valid():
            messages.add_message(request, messages.ERROR, _("Invalid request."))
            return self.redirect('/')

        return pipeline.current_step()
