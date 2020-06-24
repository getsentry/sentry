from __future__ import absolute_import

import logging

from django.views.decorators.csrf import csrf_exempt
from sentry.api.base import Endpoint
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.integrations.vercel.uninstall")


class VercelUninstallEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(VercelUninstallEndpoint, self).dispatch(request, *args, **kwargs)

    @transaction_start("VercelUninstallEndpoint")
    def delete(self, request):

        # data = request.data
        # team_id = request.data.get("teamId")

        # we need to delete the webhook associated with the integration

        # then delete the organizationIntegration

        return self.respond(status=202)
