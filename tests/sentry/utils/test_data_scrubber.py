# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.constants import FILTER_MASK
from sentry.testutils import TestCase
from sentry.utils.data_scrubber import SensitiveDataFilter


VARS = {
    'foo': 'bar',
    'password': 'hello',
    'the_secret': 'hello',
    'a_password_here': 'hello',
    'api_key': 'secret_key',
    'apiKey': 'secret_key',
}


class SensitiveDataFilterTest(TestCase):

    def _check_vars_sanitized(self, vars, proc):
        """
        Helper to check that keys have been sanitized.
        """
        assert 'foo' in vars
        assert vars['foo'] == 'bar'
        assert 'password' in vars
        assert vars['password'] == FILTER_MASK
        assert 'the_secret' in vars
        assert vars['the_secret'] == FILTER_MASK
        assert 'a_password_here' in vars
        assert vars['a_password_here'] == FILTER_MASK
        assert 'api_key' in vars
        assert vars['api_key'] == FILTER_MASK
        assert 'apiKey' in vars
        assert vars['apiKey'] == FILTER_MASK

    def test_stacktrace(self):
        data = {
            'sentry.interfaces.Stacktrace': {
                'frames': [{'vars': VARS}],
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'sentry.interfaces.Stacktrace' in data
        stack = data['sentry.interfaces.Stacktrace']
        assert 'frames' in stack
        assert len(stack['frames']) == 1
        frame = stack['frames'][0]
        assert 'vars' in frame
        self._check_vars_sanitized(frame['vars'], proc)

    def test_http(self):
        data = {
            'sentry.interfaces.Http': {
                'data': VARS,
                'env': VARS,
                'headers': list(VARS.items()),
                'cookies': VARS,
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'sentry.interfaces.Http' in data
        http = data['sentry.interfaces.Http']
        for n in ('data', 'env', 'cookies'):
            assert n in http
            self._check_vars_sanitized(http[n], proc)

        assert 'headers' in http
        self._check_vars_sanitized(dict(http['headers']), proc)

    def test_user(self):
        data = {
            'sentry.interfaces.User': {
                'username': 'secret',
                'data': VARS,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'sentry.interfaces.User' in data
        assert data['sentry.interfaces.User']['username'] == 'secret'
        self._check_vars_sanitized(data['sentry.interfaces.User']['data'], proc)

    def test_extra(self):
        data = {
            'extra': VARS
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'extra' in data
        self._check_vars_sanitized(data['extra'], proc)

    def test_contexts(self):
        data = {
            'contexts': {
                'secret': VARS,
                'biz': VARS,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'contexts' in data
        assert 'secret' in data['contexts']
        assert 'biz' in data['contexts']
        self._check_vars_sanitized(data['contexts']['secret'], proc)
        self._check_vars_sanitized(data['contexts']['biz'], proc)

    def test_querystring_as_string(self):
        data = {
            'sentry.interfaces.Http': {
                'query_string': 'foo=bar&password=hello&the_secret=hello'
                                '&a_password_here=hello&api_key=secret_key',
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'sentry.interfaces.Http' in data
        http = data['sentry.interfaces.Http']
        assert http['query_string'] == (
            'foo=bar&password=%(m)s&the_secret=%(m)s'
            '&a_password_here=%(m)s&api_key=%(m)s' % {'m': FILTER_MASK}
        )

    def test_querystring_as_string_with_partials(self):
        data = {
            'sentry.interfaces.Http': {
                'query_string': 'foo=bar&password&baz=bar',
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'sentry.interfaces.Http' in data
        http = data['sentry.interfaces.Http']
        assert http['query_string'] == 'foo=bar&password&baz=bar'

    def test_sanitize_additional_sensitive_fields(self):
        additional_sensitive_dict = {
            'fieldy_field': 'value',
            'moar_other_field': 'another value'
        }
        data = {
            'extra': dict(list(VARS.items()) + list(additional_sensitive_dict.items()))
        }

        proc = SensitiveDataFilter(additional_sensitive_dict.keys())
        proc.apply(data)

        for field in additional_sensitive_dict.keys():
            assert data['extra'][field] == FILTER_MASK

        self._check_vars_sanitized(data['extra'], proc)

    def test_sanitize_credit_card(self):
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', '4571234567890111')
        assert result == FILTER_MASK

    def test_sanitize_credit_card_amex(self):
        # AMEX numbers are 15 digits, not 16
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', '378282246310005')
        assert result == FILTER_MASK

    def test_sanitize_credit_card_discover(self):
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', '6011111111111117')
        assert result == FILTER_MASK

    def test_sanitize_credit_card_visa(self):
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', '4111111111111111')
        assert result == FILTER_MASK

    def test_sanitize_credit_card_mastercard(self):
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', '5555555555554444')
        assert result == FILTER_MASK

    def test_sanitize_credit_card_within_value(self):
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', "'4571234567890111'")
        assert result == FILTER_MASK

        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', "foo 4571234567890111")
        assert result == FILTER_MASK

    def test_does_not_sanitize_timestamp_looks_like_card(self):
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', '1453843029218310')
        assert result == '1453843029218310'

    def test_sanitize_url(self):
        proc = SensitiveDataFilter()
        result = proc.sanitize('foo', 'pg://matt:pass@localhost/1')
        assert result == 'pg://matt:%s@localhost/1' % FILTER_MASK
        # Make sure we don't mess up any other url.
        # This url specifically if passed through urlunsplit(urlsplit()),
        # it'll change the value.
        result = proc.sanitize('foo', 'postgres:///path')
        assert result == 'postgres:///path'
        result = proc.sanitize('foo', "foo 'redis://redis:foo@localhost:6379/0' bar")
        assert result == "foo 'redis://redis:%s@localhost:6379/0' bar" % FILTER_MASK
        result = proc.sanitize('foo', "'redis://redis:foo@localhost:6379/0'")
        assert result == "'redis://redis:%s@localhost:6379/0'" % FILTER_MASK
        result = proc.sanitize('foo', "foo redis://redis:foo@localhost:6379/0 bar")
        assert result == "foo redis://redis:%s@localhost:6379/0 bar" % FILTER_MASK
        result = proc.sanitize('foo', "foo redis://redis:foo@localhost:6379/0 bar pg://matt:foo@localhost/1")
        assert result == "foo redis://redis:%s@localhost:6379/0 bar pg://matt:%s@localhost/1" % (FILTER_MASK, FILTER_MASK)

    def test_sanitize_http_body(self):
        data = {
            'sentry.interfaces.Http': {
                'data': '{"email":"zzzz@gmail.com","password":"zzzzz"}',
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert 'sentry.interfaces.Http' in data
        http = data['sentry.interfaces.Http']
        assert http['data'] == FILTER_MASK

    def test_does_not_fail_on_non_string(self):
        data = {
            'extra': {
                'foo': 1,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert data['extra'] == {'foo': 1}
