from __future__ import absolute_import

from django.test.utils import override_settings
from sentry.testutils import TestCase
from sentry.services.http import SentryHTTPServer, convert_options_to_env


class HTTPServiceTest(TestCase):
    def test_convert(self):
        options = {
            'true': True,
            'false': False,
            'string': 'foo',
            'int': 1,
            'none': None,
            'hy-phen': 'foo',
        }
        expected = [
            ('UWSGI_TRUE', 'true'),
            ('UWSGI_FALSE', 'false'),
            ('UWSGI_STRING', 'foo'),
            ('UWSGI_INT', '1'),
            ('UWSGI_HY_PHEN', 'foo'),
        ]
        assert set(convert_options_to_env(options)) == set(expected)

    def test_options(self):
        cls = SentryHTTPServer

        server = cls(host='1.1.1.1', port=80)
        assert server.options['http-socket'] == '1.1.1.1:80'

        with override_settings(SENTRY_WEB_HOST='1.1.1.1', SENTRY_WEB_PORT=80):
            assert server.options['http-socket'] == '1.1.1.1:80'

        server = cls(workers=10)
        assert server.options['workers'] == 10

        # Make sure that changing `protocol` to uwsgi sets the right socket
        options = {'protocol': 'uwsgi'}
        with override_settings(SENTRY_WEB_OPTIONS=options):
            server = cls()
            assert 'http-socket' not in server.options
            assert 'uwsgi-socket' in server.options

        options = {
            'bind': '1.1.1.1:80',
            'accesslog': '/tmp/access.log',
            'errorlog': '/tmp/error.log',
            'timeout': 69,
            'proc_name': 'LOL',
            'secure_scheme_headers': {},
            'loglevel': 'info',
        }
        with override_settings(SENTRY_WEB_OPTIONS=options):
            server = cls()
            assert server.options['http-socket'] == '1.1.1.1:80'
            assert 'bind' not in server.options
            assert server.options['logto'] == '/tmp/access.log'
            assert 'accesslog' not in server.options
            assert server.options['logto2'] == '/tmp/error.log'
            assert 'errorlog' not in server.options
            assert server.options['http-timeout'] == 69
            assert 'timeout' not in server.options
            assert server.options['procname-prefix-spaced'] == 'LOL'
            assert 'proc_name' not in server.options
            assert 'secure_scheme_headers' not in server.options
            assert 'loglevel' not in server.options

    def test_format_logs(self):
        with self.options({'system.logging-format': 'human'}):
            server = SentryHTTPServer()
            assert server.options['disable-logging'] is False
        with self.options({'system.logging-format': 'machine'}):
            server = SentryHTTPServer()
            assert server.options['disable-logging'] is True
