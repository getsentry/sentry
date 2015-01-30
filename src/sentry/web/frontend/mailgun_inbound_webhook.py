from __future__ import absolute_import, print_function

import hashlib
import hmac
import logging

from django.conf import settings
from django.http import HttpResponse
from django.views.generic import View
from django.utils.crypto import constant_time_compare
from email_reply_parser import EmailReplyParser
from email.utils import parseaddr

from sentry.tasks.email import process_inbound_email
from sentry.utils.email import email_to_group_id


class MailgunInboundWebhookView(View):
    auth_required = False

    def verify(self, api_key, token, timestamp, signature):
        return constant_time_compare(signature, hmac.new(
            key=api_key,
            msg='{}{}'.format(timestamp, token),
            digestmod=hashlib.sha256
        ).hexdigest())

    def post(self, request):
        token = request.POST['token']
        signature = request.POST['signature']
        timestamp = request.POST['timestamp']

        if not settings.MAILGUN_API_KEY:
            logging.error('MAILGUN_API_KEY is not set')
            return HttpResponse(status=500)

        if not self.verify(settings.MAILGUN_API_KEY, token, timestamp, signature):
            logging.info('Unable to verify signature for mailgun request')
            return HttpResponse(status=403)

        to_email = parseaddr(request.POST['To'])[1]
        from_email = parseaddr(request.POST['From'])[1]

        try:
            group_id = email_to_group_id(to_email)
        except Exception:
            logging.info('%r is not a valid email address', to_email)
            return HttpResponse(status=500)

        payload = EmailReplyParser.parse_reply(request.POST['body-plain']).strip()
        if not payload:
            # If there's no body, we don't need to go any further
            return HttpResponse(status=200)

        process_inbound_email.delay(from_email, group_id, payload)

        return HttpResponse(status=201)
