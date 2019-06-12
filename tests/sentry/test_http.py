from __future__ import absolute_import

import platform
import responses
import pytest
import tempfile

from django.core.exceptions import SuspiciousOperation
from mock import patch, call
from urllib3.util.connection import HAS_IPV6

from sentry import http
from sentry.testutils.helpers import override_blacklist


@responses.activate
@patch('socket.getaddrinfo')
def test_simple(mock_getaddrinfo):
    mock_getaddrinfo.return_value = [(2, 1, 6, '', ('81.0.0.1', 0))]
    responses.add(responses.GET, 'http://example.com', body='foo bar')

    resp = http.safe_urlopen('http://example.com')
    data = http.safe_urlread(resp)
    assert data.decode('utf-8') == 'foo bar'

    request = responses.calls[0].request
    assert 'User-Agent' in request.headers
    assert 'gzip' in request.headers.get('Accept-Encoding', '')


@override_blacklist('127.0.0.1', '::1', '10.0.0.0/8')
# XXX(dcramer): we can't use responses here as it hooks Session.send
# @responses.activate
def test_ip_blacklist_ipv4():
    with pytest.raises(SuspiciousOperation):
        http.safe_urlopen('http://127.0.0.1')
    with pytest.raises(SuspiciousOperation):
        http.safe_urlopen('http://10.0.0.10')
    with pytest.raises(SuspiciousOperation):
        # '2130706433' is dword for '127.0.0.1'
        http.safe_urlopen('http://2130706433')


@pytest.mark.skipif(not HAS_IPV6, reason='needs ipv6')
@override_blacklist('::1')
def test_ip_blacklist_ipv6():
    with pytest.raises(SuspiciousOperation):
        http.safe_urlopen('http://[::1]')


@pytest.mark.skipif(HAS_IPV6, reason='stub for non-ipv6 systems')
@override_blacklist('::1')
@patch('socket.getaddrinfo')
def test_ip_blacklist_ipv6_fallback(mock_getaddrinfo):
    mock_getaddrinfo.return_value = [(10, 1, 6, '', ('::1', 0, 0, 0))]
    with pytest.raises(SuspiciousOperation):
        http.safe_urlopen('http://[::1]')


@pytest.mark.skipif(
    platform.system() == 'Darwin',
    reason='macOS is always broken, see comment in sentry/http.py'
)
@override_blacklist('127.0.0.1')
def test_garbage_ip():
    with pytest.raises(SuspiciousOperation):
        # '0177.0000.0000.0001' is an octal for '127.0.0.1'
        http.safe_urlopen('http://0177.0000.0000.0001')


@override_blacklist('127.0.0.1')
def test_safe_socket_connect():
    with pytest.raises(SuspiciousOperation):
        http.safe_socket_connect(('127.0.0.1', 80))


@responses.activate
def test_fetch_file():
    responses.add(
        responses.GET, 'http://example.com', body='foo bar', content_type='application/json'
    )

    temp = tempfile.TemporaryFile()
    result = http.fetch_file(url='http://example.com', domain_lock_enabled=False, outfile=temp)
    temp.seek(0)
    assert result.body is None
    assert temp.read() == 'foo bar'
    temp.close()


@responses.activate
@patch('sentry.utils.metrics.incr')
def test_metrics(incr):
    responses.add(responses.GET, 'http://example.com')

    http.safe_urlopen(
        'http://example.com',
        metrics={
            'key': 'foo',
            'instance': 'instance-name',
            'tags': {'hey': 'hi'},
        }
    )

    calls = [
        call(
            'foo.sent',
            instance='instance-name',
            tags={'hey': 'hi'},
            skip_internal=False,
        ),
        call(
            'foo.delivered',
            instance='instance-name',
            tags={'hey': 'hi', 'status_code': 200},
            skip_internal=False,
        ),
    ]

    incr.assert_has_calls(calls, any_order=True)


@responses.activate
@patch('sentry.utils.metrics.incr')
def test_metrics_defaults(incr):
    responses.add(responses.GET, 'http://example.com')

    http.safe_urlopen(
        'http://example.com',
        metrics={
            'key': 'request',
        }
    )

    calls = [
        call(
            'request.sent',
            instance='sentry.http',
            tags={},
            skip_internal=False,
        ),
        call(
            'request.delivered',
            instance='sentry.http',
            tags={'status_code': 200},
            skip_internal=False,
        ),
    ]

    incr.assert_has_calls(calls, any_order=True)


@responses.activate
@patch('sentry.utils.metrics.incr')
def test_metrics_on_failure(incr):
    responses.add(responses.GET, 'http://example.com', status=400)

    http.safe_urlopen(
        'http://example.com',
        metrics={
            'key': 'foo',
            'instance': 'instance-name',
            'tags': {'hey': 'hi'},
        },
    )

    calls = [
        call(
            'foo.sent',
            instance='instance-name',
            tags={'hey': 'hi'},
            skip_internal=False,
        ),
        call(
            'foo.failed',
            instance='instance-name',
            tags={'hey': 'hi', 'status_code': 400},
            skip_internal=False,
        ),
    ]

    incr.assert_has_calls(calls, any_order=True)
