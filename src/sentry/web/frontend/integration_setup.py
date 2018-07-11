from __future__ import absolute_import, print_function

import logging

from django.core.urlresolvers import reverse
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import BaseView

logger = logging.getLogger('sentry.integrations')


class IntegrationSetupView(BaseView):
    required_scope = 'org:integrations'

    csrf_protect = False

    def handle(self, request, provider_id):
        pipeline = IntegrationPipeline.get_for_request(request=request)
        # handle installing integration straight from GitHub
        if request.path == u'/extensions/github/setup/' and request.GET.get(
                'setup_action') == 'install':
            installation_id = request.GET.get('installation_id')
            return self.redirect(reverse('integration-installation', args=[installation_id]))

        if not pipeline:
            logging.error('integration.setup-error')
            return self.redirect('/')

        return pipeline.current_step()
