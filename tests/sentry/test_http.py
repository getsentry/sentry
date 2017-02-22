from __future__ import absolute_import

import ipaddress
import platform
import responses
import pytest

from django.core.exceptions import SuspiciousOperation
from mock import patch

from sentry import http
from sentry.testutils import TestCase


class HttpTest(TestCase):
    @responses.activate
    @patch('socket.getaddrinfo')
    def test_simple(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [(2, 1, 6, '', ('81.0.0.1', 0))]
        responses.add(responses.GET, 'http://example.com', body='foo bar')

        resp = http.safe_urlopen('http://example.com')
        data = http.safe_urlread(resp)
        assert data.decode('utf-8') == 'foo bar'

        request = responses.calls[0].request
        assert 'User-Agent' in request.headers
        assert 'gzip' in request.headers.get('Accept-Encoding', '')

    # XXX(dcramer): we can't use responses here as it hooks Session.send
    # @responses.activate
    def test_ip_blacklist(self):
        http.DISALLOWED_IPS = set([
            ipaddress.ip_network(u'127.0.0.1'),
            ipaddress.ip_network(u'::1'),
            ipaddress.ip_network(u'10.0.0.0/8'),
        ])
        with pytest.raises(SuspiciousOperation):
            http.safe_urlopen('http://127.0.0.1')
        with pytest.raises(SuspiciousOperation):
            http.safe_urlopen('http://10.0.0.10')
        with pytest.raises(SuspiciousOperation):
            # '2130706433' is dword for '127.0.0.1'
            http.safe_urlopen('http://2130706433')
        with pytest.raises(SuspiciousOperation):
            # ipv6
            http.safe_urlopen('http://[::1]')

    @pytest.mark.skipif(platform.system() == 'Darwin',
                        reason='macOS is always broken, see comment in sentry/http.py')
    def test_garbage_ip(self):
        http.DISALLOWED_IPS = set([ipaddress.ip_network(u'127.0.0.1')])
        with pytest.raises(SuspiciousOperation):
            # '0177.0000.0000.0001' is an octal for '127.0.0.1'
            http.safe_urlopen('http://0177.0000.0000.0001')
