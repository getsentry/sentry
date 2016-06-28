from __future__ import absolute_import

import responses
import pytest

from django.core.exceptions import SuspiciousOperation
from ipaddr import IPNetwork
from mock import patch

from sentry import http
from sentry.testutils import TestCase


class HttpTest(TestCase):
    @responses.activate
    @patch('socket.gethostbyname')
    def test_simple(self, mock_gethostbyname):
        mock_gethostbyname.return_value = '81.0.0.1'
        responses.add(responses.GET, 'http://example.com', body='foo bar')

        resp = http.safe_urlopen('http://example.com')
        data = http.safe_urlread(resp)
        assert data == 'foo bar'

        request = responses.calls[0].request
        assert 'User-Agent' in request.headers
        assert 'gzip' in request.headers.get('Accept-Encoding', '')

    # XXX(dcramer): we can't use responses here as it hooks Session.send
    # @responses.activate
    def test_ip_blacklist(self):
        http.DISALLOWED_IPS = set([IPNetwork('127.0.0.1')])
        with pytest.raises(SuspiciousOperation):
            http.safe_urlopen('http://127.0.0.1')
