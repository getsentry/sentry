from __future__ import absolute_import

import six
import hmac
import hashlib
import logging

from django.utils.crypto import constant_time_compare
from django.views.decorators.csrf import csrf_exempt
from sentry import options
from sentry.api.base import Endpoint
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.integrations.vercel.webhooks")


def verify_signature(request):
    signature = request.META["HTTP_X_ZEIT_SIGNATURE"]
    secret = options.get("vercel.client-secret")

    expected = hmac.new(
        key=secret.encode("utf-8"), msg=six.binary_type(request.body), digestmod=hashlib.sha1
    ).hexdigest()
    return constant_time_compare(expected, signature)


class VercelWebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(VercelWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    @transaction_start("VercelWebhookEndpoint")
    def post(self, request):
        if not request.META.get("HTTP_X_ZEIT_SIGNATURE"):
            logger.error("vercel.webhook.missing-signature")
            self.respond(status=401)

        is_valid = verify_signature(request)

        if not is_valid:
            logger.error("vercel.webhook.invalid-signature")
            return self.respond(status=401)

        return self.respond(status=200)
