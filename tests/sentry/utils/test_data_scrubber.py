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
        self.assertTrue('foo' in vars)
        self.assertEquals(vars['foo'], 'bar')
        self.assertTrue('password' in vars)
        self.assertEquals(vars['password'], FILTER_MASK)
        self.assertTrue('the_secret' in vars)
        self.assertEquals(vars['the_secret'], FILTER_MASK)
        self.assertTrue('a_password_here' in vars)
        self.assertEquals(vars['a_password_here'], FILTER_MASK)
        self.assertTrue('api_key' in vars)
        self.assertEquals(vars['api_key'], FILTER_MASK)
        self.assertTrue('apiKey' in vars)
        self.assertEquals(vars['apiKey'], FILTER_MASK)

    def test_stacktrace(self):
        data = {
            'sentry.interfaces.Stacktrace': {
                'frames': [{'vars': VARS}],
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        self.assertTrue('sentry.interfaces.Stacktrace' in data)
        stack = data['sentry.interfaces.Stacktrace']
        self.assertTrue('frames' in stack)
        self.assertEquals(len(stack['frames']), 1)
        frame = stack['frames'][0]
        self.assertTrue('vars' in frame)
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

        self.assertTrue('sentry.interfaces.Http' in data)
        http = data['sentry.interfaces.Http']
        for n in ('data', 'env', 'cookies'):
            assert n in http
            self._check_vars_sanitized(http[n], proc)

        assert 'headers' in http
        self._check_vars_sanitized(dict(http['headers']), proc)

    def test_extra(self):
        data = {
            'extra': VARS
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        self.assertTrue('extra' in data)
        self._check_vars_sanitized(data['extra'], proc)

    def test_querystring_as_string(self):
        data = {
            'sentry.interfaces.Http': {
                'query_string': 'foo=bar&password=hello&the_secret=hello'
                                '&a_password_here=hello&api_key=secret_key',
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        self.assertTrue('sentry.interfaces.Http' in data)
        http = data['sentry.interfaces.Http']
        self.assertEquals(
            http['query_string'],
            'foo=bar&password=%(m)s&the_secret=%(m)s'
            '&a_password_here=%(m)s&api_key=%(m)s' % dict(m=FILTER_MASK))

    def test_querystring_as_string_with_partials(self):
        data = {
            'sentry.interfaces.Http': {
                'query_string': 'foo=bar&password&baz=bar',
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        self.assertTrue('sentry.interfaces.Http' in data)
        http = data['sentry.interfaces.Http']
        self.assertEquals(http['query_string'], 'foo=bar&password&baz=bar' % dict(m=FILTER_MASK))

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
            self.assertEquals(data['extra'][field], FILTER_MASK)

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
        self.assertEquals(result, 'pg://matt:%s@localhost/1' % FILTER_MASK)
        # Make sure we don't mess up any other url.
        # This url specifically if passed through urlunsplit(urlsplit()),
        # it'll change the value.
        result = proc.sanitize('foo', 'postgres:///path')
        self.assertEquals(result, 'postgres:///path')
        result = proc.sanitize('foo', "foo 'redis://redis:foo@localhost:6379/0' bar")
        self.assertEquals(result, "foo 'redis://redis:%s@localhost:6379/0' bar" % FILTER_MASK)
        result = proc.sanitize('foo', "'redis://redis:foo@localhost:6379/0'")
        self.assertEquals(result, "'redis://redis:%s@localhost:6379/0'" % FILTER_MASK)
        result = proc.sanitize('foo', "foo redis://redis:foo@localhost:6379/0 bar")
        self.assertEquals(result, "foo redis://redis:%s@localhost:6379/0 bar" % FILTER_MASK)
        result = proc.sanitize('foo', "foo redis://redis:foo@localhost:6379/0 bar pg://matt:foo@localhost/1")
        self.assertEquals(result, "foo redis://redis:%s@localhost:6379/0 bar pg://matt:%s@localhost/1" % (FILTER_MASK, FILTER_MASK))

    def test_sanitize_http_body(self):
        data = {
            'sentry.interfaces.Http': {
                'data': '{"email":"zzzz@gmail.com","password":"zzzzz"}',
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        self.assertTrue('sentry.interfaces.Http' in data)
        http = data['sentry.interfaces.Http']
        self.assertEquals(http['data'], FILTER_MASK)

    def test_does_not_fail_on_non_string(self):
        data = {
            'extra': {
                'foo': 1,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        self.assertEquals(data['extra'], {'foo': 1})
