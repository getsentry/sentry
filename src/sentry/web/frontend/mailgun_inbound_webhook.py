from __future__ import absolute_import, print_function

from hashlib import sha256
import hmac
import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from email_reply_parser import EmailReplyParser
from email.utils import parseaddr

from sentry import options
from sentry.tasks.email import process_inbound_email
from sentry.utils.email import email_to_group_id


class MailgunInboundWebhookView(View):
    def verify(self, api_key, token, timestamp, signature):
        return constant_time_compare(signature, hmac.new(
            key=api_key,
            msg='{}{}'.format(timestamp, token),
            digestmod=sha256
        ).hexdigest())

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super(MailgunInboundWebhookView, self).dispatch(*args, **kwargs)

    def post(self, request):
        token = request.POST['token']
        signature = request.POST['signature']
        timestamp = request.POST['timestamp']

        key = options.get('mail.mailgun-api-key')
        if not key:
            logging.error('mail.mailgun-api-key is not set')
            return HttpResponse(status=500)

        if not self.verify(key, token, timestamp, signature):
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
