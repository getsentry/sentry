# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.auth import get_auth_header
from sentry.services.udp import SentryUDPServer

from tests.base import TestCase


class SentryUDPTest(TestCase):
    def setUp(self):
        self.address = (('0.0.0.0', 0))
        self.server = SentryUDPServer(*self.address)

    def test_failure(self):
        self.assertNotEquals(None, self.server.handle('deadbeef', self.address))

    def test_success(self):
        data = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        ts, message, sig = self._makeMessage(data)
        packet = get_auth_header(sig, ts, 'udpTest') + '\n\n' + message
        self.assertEquals(None, self.server.handle(packet, self.address))
