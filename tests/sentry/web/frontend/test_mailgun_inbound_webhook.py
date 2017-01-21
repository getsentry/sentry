from __future__ import absolute_import, print_function

import mock

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase
from sentry.utils.email import group_id_to_email

body_plain = "foo bar"


class TestMailgunInboundWebhookView(TestCase):
    def setUp(self):
        super(TestMailgunInboundWebhookView, self).setUp()
        self.event = self.create_event(event_id='a' * 32)
        self.mailto = group_id_to_email(self.group.pk)

    @mock.patch('sentry.web.frontend.mailgun_inbound_webhook.process_inbound_email')
    def test_invalid_signature(self, process_inbound_email):
        with self.options({'mail.mailgun-api-key': 'a' * 32}):
            resp = self.client.post(reverse('sentry-mailgun-inbound-hook'), {
                'recipient': self.mailto,
                'sender': self.user.email,
                'body-plain': body_plain,
                'signature': '',
                'token': '',
                'timestamp': '',
            })
            assert resp.status_code == 200

    @mock.patch('sentry.web.frontend.mailgun_inbound_webhook.process_inbound_email')
    def test_missing_api_key(self, process_inbound_email):
        resp = self.client.post(reverse('sentry-mailgun-inbound-hook'), {
            'recipient': self.mailto,
            'sender': self.user.email,
            'body-plain': body_plain,
            'signature': '',
            'token': '',
            'timestamp': '',
        })
        assert resp.status_code == 500

    @mock.patch('sentry.web.frontend.mailgun_inbound_webhook.process_inbound_email')
    def test_simple(self, process_inbound_email):
        token = 'a' * 50
        timestamp = '1422513193'
        signature = '414a4705e6c12a39905748549f9135fbe8b739a5b12b2349ee40f31d3ee12f83'

        with self.options({'mail.mailgun-api-key': 'a' * 32}):
            resp = self.client.post(reverse('sentry-mailgun-inbound-hook'), {
                'recipient': self.mailto,
                'sender': self.user.email,
                'body-plain': body_plain,
                'signature': signature,
                'token': token,
                'timestamp': timestamp,
            })
        assert resp.status_code == 201
        process_inbound_email.delay.assert_called_once_with(
            self.user.email,
            self.group.id,
            body_plain,
        )
