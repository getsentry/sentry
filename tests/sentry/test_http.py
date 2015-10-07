from __future__ import absolute_import

import responses
import pytest

from django.core.exceptions import SuspiciousOperation

from sentry.http import safe_urlopen, safe_urlread
from sentry.testutils import TestCase


class HttpTest(TestCase):
    @responses.activate
    def test_simple(self):
        responses.add(responses.GET, 'http://example.com', body='foo bar')

        resp = safe_urlopen('http://example.com')
        data = safe_urlread(resp)
        assert data == 'foo bar'

        request = responses.calls[0].request
        assert 'User-Agent' in request.headers
        assert 'gzip' in request.headers.get('Accept-Encoding', '')

    # XXX(dcramer): we can't use responses here as it hooks Session.send
    # @responses.activate
    def test_ip_blacklist(self):
        with pytest.raises(SuspiciousOperation):
            safe_urlopen('http://127.0.0.1')
