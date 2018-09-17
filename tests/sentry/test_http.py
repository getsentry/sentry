from __future__ import absolute_import

import ipaddress
import platform
import responses
import pytest
import tempfile

from django.core.exceptions import SuspiciousOperation
from mock import patch

from sentry import http
from sentry.testutils import TestCase


def stub_blacklist(ip_addresses):
    def decorator(func):
        def wrapper(*args, **kwargs):
            disallowed_ips = set(http.DISALLOWED_IPS)
            http.DISALLOWED_IPS = set(
                ipaddress.ip_network(ip) for ip in ip_addresses
            )
            func(*args, **kwargs)
            http.DISALLOWED_IPS = disallowed_ips
        return wrapper
    return decorator


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
    @stub_blacklist([u'127.0.0.1', u'::1', u'10.0.0.0/8'])
    def test_ip_blacklist(self):
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

    @pytest.mark.skipif(
        platform.system() == 'Darwin',
        reason='macOS is always broken, see comment in sentry/http.py'
    )
    @stub_blacklist([u'127.0.0.1'])
    def test_garbage_ip(self):
        with pytest.raises(SuspiciousOperation):
            # '0177.0000.0000.0001' is an octal for '127.0.0.1'
            http.safe_urlopen('http://0177.0000.0000.0001')

    @stub_blacklist([u'127.0.0.1'])
    def test_safe_socket_connect(self):
        with pytest.raises(SuspiciousOperation):
            http.safe_socket_connect(('127.0.0.1', 80))

    @responses.activate
    def test_fetch_file(self):
        responses.add(
            responses.GET, 'http://example.com', body='foo bar', content_type='application/json'
        )

        temp = tempfile.TemporaryFile()
        result = http.fetch_file(url='http://example.com', domain_lock_enabled=False, outfile=temp)
        temp.seek(0)
        assert result.body is None
        assert temp.read() == 'foo bar'
        temp.close()
