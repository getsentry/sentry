# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.constants import FILTER_MASK
from unittest import TestCase
from sentry.utils.data_scrubber import SensitiveDataFilter

VARS = {
    'foo': 'bar',
    'password': 'hello',
    'the_secret': 'hello',
    'a_password_here': 'hello',
    'api_key': 'secret_key',
    'apiKey': 'secret_key',
}

PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA6A6TQjlPyMurLh/igZY4
izA9sJgeZ7s5+nGydO4AI9k33gcy2DObZuadWRMnDwc3uH/qoAPw/mo3KOcgEtxU
xdwiQeATa3HVPcQDCQiKm8xIG2Ny0oUbR0IFNvClvx7RWnPEMk05CuvsL0AA3eH5
xn02Yg0JTLgZEtUT3whwFm8CAwEAAQ==
-----END PUBLIC KEY-----"""

PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
MIIJRAIBADANBgkqhkiG9w0BAQEFAASCCS4wggkqAgEAAoICAQCoNFY4P+EeIXl0
mLpO+i8uFqAaEFQ8ZX2VVpA13kNEHuiWXC3HPlQ+7G+O3XmAsO+Wf/xY6pCSeQ8h
mLpO+i8uFqAaEFQ8ZX2VVpA13kNEHuiWXC3HPlQ+7G+O3XmAsO+Wf/xY6pCSeQ8h
-----END PRIVATE KEY-----"""

ENCRYPTED_PRIVATE_KEY = """-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIJjjBABgkqhkiG9w0BBQ0wMzAbBgkqhkiG9w0BBQwwDgQIWVhErdQOFVoCAggA
IrlYQUV1ig4U3viYh1Y8viVvRlANKICvgj4faYNH36UterkfDjzMonb/cXNeJEOS
YgorM2Pfuec5vtPRPKd88+Ds/ktIlZhjJwnJjHQMX+lSw5t0/juna2sLH2dpuAbi
PSk=
-----END ENCRYPTED PRIVATE KEY-----"""

RSA_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
+wn9Iu+zgamKDUu22xc45F2gdwM04rTITlZgjAs6U1zcvOzGxk8mWJD5MqFWwAtF
zN87YGV0VMTG6ehxnkI4Fg6i0JPU3QIDAQABAoICAQCoCPjlYrODRU+vd2YeU/gM
THd+9FBxiHLGXNKhG/FRSyREXEt+NyYIf/0cyByc9tNksat794ddUqnLOg0vwSkv
-----END RSA PRIVATE KEY-----"""


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
            'stacktrace': {
                'frames': [{
                    'vars': VARS
                }],
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'stacktrace' in data
        stack = data['stacktrace']
        assert 'frames' in stack
        assert len(stack['frames']) == 1
        frame = stack['frames'][0]
        assert 'vars' in frame
        self._check_vars_sanitized(frame['vars'], proc)

    def test_http(self):
        data = {
            'request': {
                'data': VARS,
                'env': VARS,
                'headers': list(VARS.items()),
                'cookies': VARS,
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'request' in data
        http = data['request']
        for n in ('data', 'env', 'cookies'):
            assert n in http
            self._check_vars_sanitized(http[n], proc)

        assert 'headers' in http
        self._check_vars_sanitized(dict(http['headers']), proc)

    def test_user(self):
        data = {
            'user': {
                'username': 'secret',
                'data': VARS,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'user' in data
        assert data['user']['username'] == 'secret'
        self._check_vars_sanitized(data['user']['data'], proc)

    def test_extra(self):
        data = {'extra': VARS}

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
            'request': {
                'query_string':
                'foo=bar&password=hello&the_secret=hello'
                '&a_password_here=hello&api_key=secret_key',
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'request' in data
        http = data['request']
        assert http['query_string'] == (
            'foo=bar&password=%(m)s&the_secret=%(m)s'
            '&a_password_here=%(m)s&api_key=%(m)s' % {
                'm': FILTER_MASK
            }
        )

    def test_querystring_as_pairlist(self):
        data = {
            'request': {
                'query_string': [
                    ['foo', 'bar'],
                    ['password', 'hello'],
                    ['the_secret', 'hello'],
                    ['a_password_here', 'hello'],
                    ['api_key', 'secret_key'],
                ],
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'request' in data
        http = data['request']
        assert http['query_string'] == [
            ['foo', 'bar'],
            ['password', FILTER_MASK],
            ['the_secret', FILTER_MASK],
            ['a_password_here', FILTER_MASK],
            ['api_key', FILTER_MASK],
        ]

    def test_querystring_as_string_with_partials(self):
        data = {
            'request': {
                'query_string': 'foo=bar&password&baz=bar',
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'request' in data
        http = data['request']
        assert http['query_string'] == 'foo=bar&password&baz=bar'

    def test_querystring_as_pairlist_with_partials(self):
        data = {
            'request': {
                'query_string': [
                    ['foo', 'bar'],
                    ['password', ''],
                    ['baz', 'bar'],
                ]
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'request' in data
        http = data['request']
        assert http['query_string'] == [
            ['foo', 'bar'],
            ['password', ''],
            ['baz', 'bar'],
        ]

    def test_sanitize_additional_sensitive_fields(self):
        additional_sensitive_dict = {'fieldy_field': 'value', 'moar_other_field': 'another value'}
        data = {'extra': dict(list(VARS.items()) + list(additional_sensitive_dict.items()))}

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
        result = proc.sanitize('foo', "foo 'redis://redis:foo@localhost:6379/0' bar")
        assert result == "foo 'redis://redis:%s@localhost:6379/0' bar" % FILTER_MASK
        result = proc.sanitize('foo', "'redis://redis:foo@localhost:6379/0'")
        assert result == "'redis://redis:%s@localhost:6379/0'" % FILTER_MASK
        result = proc.sanitize('foo', "foo redis://redis:foo@localhost:6379/0 bar")
        assert result == "foo redis://redis:%s@localhost:6379/0 bar" % FILTER_MASK
        result = proc.sanitize(
            'foo', "foo redis://redis:foo@localhost:6379/0 bar pg://matt:foo@localhost/1"
        )
        assert result == "foo redis://redis:%s@localhost:6379/0 bar pg://matt:%s@localhost/1" % (
            FILTER_MASK, FILTER_MASK
        )
        # Make sure we don't mess up any other url.
        # This url specifically if passed through urlunsplit(urlsplit()),
        # it'll change the value.
        result = proc.sanitize('foo', 'postgres:///path')
        assert result == 'postgres:///path'
        # Don't be too overly eager within JSON strings an catch the right field.
        result = proc.sanitize(
            'foo',
            '{"a":"https://localhost","b":"foo@localhost","c":"pg://matt:pass@localhost/1","d":"lol"}'
        )
        assert result == '{"a":"https://localhost","b":"foo@localhost","c":"pg://matt:%s@localhost/1","d":"lol"}' % FILTER_MASK

    def test_sanitize_http_body(self):
        data = {
            'request': {
                'data': '{"email":"zzzz@gmail.com","password":"zzzzz"}',
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert 'request' in data
        http = data['request']
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

    def test_does_sanitize_public_key(self):
        data = {
            'extra': {
                's': PUBLIC_KEY,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert data['extra'] == {'s': FILTER_MASK}

    def test_does_sanitize_private_key(self):
        data = {
            'extra': {
                's': PRIVATE_KEY,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert data['extra'] == {'s': FILTER_MASK}

    def test_does_sanitize_encrypted_private_key(self):
        data = {
            'extra': {
                's': ENCRYPTED_PRIVATE_KEY,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert data['extra'] == {'s': FILTER_MASK}

    def test_does_sanitize_rsa_private_key(self):
        data = {
            'extra': {
                's': RSA_PRIVATE_KEY,
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert data['extra'] == {'s': FILTER_MASK}

    def test_does_sanitize_social_security_number(self):
        data = {
            'extra': {
                's': '123-45-6789',
            },
        }

        proc = SensitiveDataFilter()
        proc.apply(data)
        assert data['extra'] == {'s': FILTER_MASK}

    def test_exclude_fields_on_field_name(self):
        data = {
            'extra': {
                'password': '123-45-6789',
            },
        }

        proc = SensitiveDataFilter(exclude_fields=['password'])
        proc.apply(data)
        assert data['extra'] == {'password': '123-45-6789'}

    def test_explicit_fields(self):
        data = {
            'extra': {
                'mystuff': 'xxx',
            },
        }

        proc = SensitiveDataFilter(fields=['mystuff'])
        proc.apply(data)
        assert data['extra']['mystuff'] == FILTER_MASK

    def test_explicit_fields_case_insensitive(self):
        data = {
            'extra': {
                'myStuff': 'xxx',
            },
        }

        proc = SensitiveDataFilter(fields=['myStuff'])
        proc.apply(data)
        assert data['extra']['myStuff'] == FILTER_MASK

        data = {
            'extra': {
                'MYSTUFF': 'xxx',
            },
        }

        proc = SensitiveDataFilter(fields=['myStuff'])
        proc.apply(data)
        assert data['extra']['MYSTUFF'] == FILTER_MASK

        data = {
            'extra': {
                'mystuff': 'xxx',
            },
        }

        proc = SensitiveDataFilter(fields=['myStuff'])
        proc.apply(data)
        assert data['extra']['mystuff'] == FILTER_MASK

    def test_exclude_fields_on_field_value(self):
        data = {
            'extra': {
                'foobar': '123-45-6789',
            },
        }

        proc = SensitiveDataFilter(exclude_fields=['foobar'])
        proc.apply(data)
        assert data['extra'] == {'foobar': '123-45-6789'}

    def test_empty_field(self):
        data = {
            'extra': {
                'foobar': 'xxx',
            },
        }

        proc = SensitiveDataFilter(fields=[''])
        proc.apply(data)
        assert data['extra'] == {'foobar': 'xxx'}

    def test_should_have_mysql_pwd_as_a_default(self):
        proc = SensitiveDataFilter(include_defaults=True)
        assert proc.sanitize('MYSQL_PWD', 'the one') == FILTER_MASK
        assert proc.sanitize('mysql_pwd', 'the two') == FILTER_MASK

    def test_authorization_scrubbing(self):
        proc = SensitiveDataFilter(include_defaults=True)
        assert proc.sanitize('authorization', 'foobar') == FILTER_MASK
        assert proc.sanitize('auth', 'foobar') == FILTER_MASK
        assert proc.sanitize('auXth', 'foobar') == 'foobar'

    def test_doesnt_scrub_not_scrubbed(self):
        proc = SensitiveDataFilter(include_defaults=True)
        assert proc.sanitize('is_authenticated', 'foobar') == FILTER_MASK
        assert proc.sanitize('is_authenticated', 'null') == 'null'
        assert proc.sanitize('is_authenticated', True) is True

    def test_csp_blocked_uri(self):
        data = {
            'csp': {
                'blocked_uri': 'https://example.com/?foo=4571234567890111&bar=baz',
            }
        }

        proc = SensitiveDataFilter()
        proc.apply(data)

        assert 'csp' in data
        csp = data['csp']
        assert csp['blocked_uri'] == 'https://example.com/?foo=[Filtered]&bar=baz'

    def test_breadcrumb_message(self):
        data = {
            'breadcrumbs': {
                'values': [{
                    'message': "SELECT session_key FROM django_session WHERE session_key = 'abcdefg'",
                }],
            },
        }

        proc = SensitiveDataFilter(fields=['session_key'])
        proc.apply(data)

        assert data['breadcrumbs']['values'][0]['message'] == FILTER_MASK
