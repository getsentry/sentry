from __future__ import absolute_import

import os.path

from sentry.models import Activity
from sentry.services.smtp import SentrySMTPServer, STATUS
from sentry.testutils import TestCase
from sentry.utils.email import (
    group_id_to_email, email_to_group_id, _CaseInsensitiveSigner,
)

fixture = open(os.path.dirname(os.path.realpath(__file__)) + '/email.txt').read()


class SentrySMTPTest(TestCase):
    def setUp(self):
        self.address = ('0.0.0.0', 0)
        self.server = SentrySMTPServer(*self.address)
        self.mailto = group_id_to_email(self.group.pk)
        self.event  # side effect of generating an event

    def test_decode_email_address(self):
        self.assertEqual(email_to_group_id(self.mailto), self.group.pk)

    def test_process_message(self):
        with self.tasks():
            self.assertEqual(self.server.process_message('', self.user.email, [self.mailto], fixture), STATUS[200])
        self.assertEqual(Activity.objects.filter(type=Activity.NOTE)[0].data, {'text': 'sup'})

    def test_process_message_no_recipients(self):
        with self.tasks():
            self.assertEqual(self.server.process_message('', self.user.email, [], fixture), STATUS[550])

    def test_process_message_too_long(self):
        with self.tasks():
            self.assertEqual(self.server.process_message('', self.user.email, [self.mailto], fixture * 100), STATUS[552])
        self.assertEqual(Activity.objects.count(), 0)

    def test_process_message_invalid_email(self):
        with self.tasks():
            self.assertEqual(self.server.process_message('', self.user.email, ['lol@localhost'], fixture), STATUS[550])


class CaseInsensitiveSignerTests(TestCase):
    def test_it_works(self):
        with self.settings(SECRET_KEY='a'):
            signer = _CaseInsensitiveSigner()
            assert signer.unsign(signer.sign('foo')) == 'foo'
            assert signer.sign('foo') == 'foo:wkpxg5djz3d4m0zktktfl9hdzw4'
            assert signer.unsign('foo:WKPXG5DJZ3D4M0ZKTKTFL9HDZW4') == 'foo'
