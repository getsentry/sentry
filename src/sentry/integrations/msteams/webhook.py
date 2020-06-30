from __future__ import absolute_import

import hashlib
import hmac
import logging
import six

from django.views.decorators.csrf import csrf_exempt
from django.utils.crypto import constant_time_compare
from requests.exceptions import RequestException
from sentry import http, options
from sentry.api.base import Endpoint
from sentry.models import (
    OrganizationIntegration,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
    Project,
)
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri
from sentry.utils.compat import filter
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.integrations.msteams.webhooks")


def verify_signature(request):
    return True


class MsTeamsWebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(MsTeamsWebhookEndpoint, self).dispatch(request, *args, **kwargs)


    @transaction_start("MsTeamsWebhookEndpoint")
    def post(self, request):
        is_valid = verify_signature(request)

        if not is_valid:
            logger.error("msteams.webhook.invalid-signature")
            return self.respond(status=401)

        data = request.data
        print('data', data)
        return self.respond(status=202)
