# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.utils import linksign
from django.test.client import RequestFactory


class LinkSignTestCase(TestCase):

    def test_link_signing(self):
        url = linksign.generate_signed_link(self.user, 'sentry')
        assert url.startswith('http://')

        req = RequestFactory().get('/' + url.split('/', 3)[-1])
        signed_user = linksign.process_signature(req)
        assert signed_user
        assert signed_user.id == self.user.id

        req = RequestFactory().get('/what' + url.split('/', 3)[-1])
        signed_user = linksign.process_signature(req)
        assert signed_user is None

        req = RequestFactory().get('/' + url.split('/', 3)[-1] + 'garbage')
        signed_user = linksign.process_signature(req)
        assert signed_user is None
