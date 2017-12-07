# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six
import mock
import pytest

from django.core.exceptions import SuspiciousOperation
from sentry.constants import VERSION_LENGTH
from uuid import UUID

from sentry.coreapi import (
    APIError,
    APIUnauthorized,
    Auth,
    ClientApiHelper,
    SecurityApiHelper,
)
from sentry.event_manager import EventManager
from sentry.interfaces.base import get_interface
from sentry.testutils import TestCase


class BaseAPITest(TestCase):
    helper_cls = ClientApiHelper

    def setUp(self):
        self.user = self.create_user('coreapi@example.com')
        self.team = self.create_team(name='Foo')
        self.project = self.create_project(team=self.team)
        self.pk = self.project.key_set.get_or_create()[0]
        self.helper = self.helper_cls(agent='Awesome Browser', ip_address='198.51.100.0')

    def validate_and_normalize(self, data, request_env=None):
        data = self.helper.validate_data(data)
        return EventManager(data).normalize(request_env=request_env)


class AuthFromRequestTest(BaseAPITest):
    def test_valid(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry sentry_key=value, biz=baz'}
        request.GET = {}
        result = self.helper.auth_from_request(request)
        assert result.public_key == 'value'

    def test_valid_missing_space(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry sentry_key=value,biz=baz'}
        request.GET = {}
        result = self.helper.auth_from_request(request)
        assert result.public_key == 'value'

    def test_valid_ignore_case(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'SeNtRy sentry_key=value, biz=baz'}
        request.GET = {}
        result = self.helper.auth_from_request(request)
        assert result.public_key == 'value'

    def test_invalid_header_defers_to_GET(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'foobar'}
        request.GET = {'sentry_version': '1', 'foo': 'bar'}
        result = self.helper.auth_from_request(request)
        assert result.version == '1'

    def test_invalid_legacy_header_defers_to_GET(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'foobar'}
        request.GET = {'sentry_version': '1', 'foo': 'bar'}
        result = self.helper.auth_from_request(request)
        assert result.version == '1'

    def test_invalid_header_bad_token(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentryfoo'}
        request.GET = {}
        with self.assertRaises(APIUnauthorized):
            self.helper.auth_from_request(request)

    def test_invalid_header_missing_pair(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry foo'}
        request.GET = {}
        with self.assertRaises(APIUnauthorized):
            self.helper.auth_from_request(request)

    def test_invalid_malformed_value(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry sentry_key=value,,biz=baz'}
        request.GET = {}
        with self.assertRaises(APIUnauthorized):
            self.helper.auth_from_request(request)

    def test_multiple_auth_suspicious(self):
        request = mock.Mock()
        request.GET = {'sentry_version': '1', 'foo': 'bar'}
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry sentry_key=value, biz=baz'}
        with pytest.raises(SuspiciousOperation):
            self.helper.auth_from_request(request)


class ProjectIdFromAuthTest(BaseAPITest):
    def test_invalid_if_missing_key(self):
        self.assertRaises(APIUnauthorized, self.helper.project_id_from_auth, Auth({}))

    def test_valid_with_key(self):
        auth = Auth({'sentry_key': self.pk.public_key})
        result = self.helper.project_id_from_auth(auth)
        self.assertEquals(result, self.project.id)

    def test_invalid_key(self):
        auth = Auth({'sentry_key': 'z'})
        self.assertRaises(APIUnauthorized, self.helper.project_id_from_auth, auth)

    def test_invalid_secret(self):
        auth = Auth({'sentry_key': self.pk.public_key, 'sentry_secret': 'z'})
        self.assertRaises(APIUnauthorized, self.helper.project_id_from_auth, auth)

    def test_nonascii_key(self):
        auth = Auth({'sentry_key': '\xc3\xbc'})
        self.assertRaises(APIUnauthorized, self.helper.project_id_from_auth, auth)


class ValidateDataTest(BaseAPITest):
    @mock.patch('uuid.uuid4', return_value=UUID('031667ea1758441f92c7995a428d2d14'))
    def test_empty_event_id(self, uuid4):
        data = self.validate_and_normalize({
            'event_id': '',
        })
        assert data['event_id'] == '031667ea1758441f92c7995a428d2d14'

    @mock.patch('uuid.uuid4', return_value=UUID('031667ea1758441f92c7995a428d2d14'))
    def test_missing_event_id(self, uuid4):
        data = self.validate_and_normalize({})
        assert data['event_id'] == '031667ea1758441f92c7995a428d2d14'

    @mock.patch('uuid.uuid4', return_value=UUID('031667ea1758441f92c7995a428d2d14'))
    def test_invalid_event_id(self, uuid4):
        data = self.validate_and_normalize({
            'event_id': 'a' * 33,
        })
        assert data['event_id'] == '031667ea1758441f92c7995a428d2d14'
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'value_too_long'
        assert data['errors'][0]['name'] == 'event_id'
        assert data['errors'][0]['value'] == 'a' * 33

        data = self.validate_and_normalize({
            'event_id': 'xyz',
        })
        assert data['event_id'] == '031667ea1758441f92c7995a428d2d14'
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'event_id'
        assert data['errors'][0]['value'] == 'xyz'

    def test_unknown_attribute(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'foo': 'bar',
        })
        assert 'foo' not in data
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_attribute'
        assert data['errors'][0]['name'] == 'foo'

    def test_invalid_interface_name(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'foo.baz': 'bar',
        })
        assert 'foo.baz' not in data
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_attribute'
        assert data['errors'][0]['name'] == 'foo.baz'

    def test_invalid_interface_import_path(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'sentry.interfaces.Exception2': 'bar',
        })
        assert 'sentry.interfaces.Exception2' not in data
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_attribute'
        assert data['errors'][0]['name'] == 'sentry.interfaces.Exception2'

    def test_does_expand_list(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'exception':
                [{
                    'type': 'ValueError',
                    'value': 'hello world',
                    'module': 'foo.bar',
                }]
        })
        assert 'sentry.interfaces.Exception' in data

    def test_log_level_as_string(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'level': 'error',
        })
        assert data['level'] == 40

    def test_invalid_log_level(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'level': 'foobar',
        })
        assert data['level'] == 40
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'level'
        assert data['errors'][0]['value'] == 'foobar'

    def test_tags_as_string(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'tags': 'bar',
        })
        assert data['tags'] == []

    def test_tags_with_spaces(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'tags': {
                'foo bar': 'baz bar'
            },
        })
        assert data['tags'] == [('foo-bar', 'baz bar')]

    def test_tags_out_of_bounds(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'tags': {
                'f' * 33: 'value',
                'foo': 'v' * 201,
                'bar': 'value'
            },
        })
        assert data['tags'] == [('bar', 'value')]
        assert len(data['errors']) == 2

    def test_tags_as_invalid_pair(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'tags': [('foo', 'bar'), ('biz', 'baz', 'boz')],
        })
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'tags'
        assert data['errors'][0]['value'] == [('foo', 'bar'), ('biz', 'baz', 'boz')]

    def test_reserved_tags(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'tags': [('foo', 'bar'), ('release', 'abc123')],
        })
        assert data['tags'] == [('foo', 'bar')]
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'tags'
        assert data['errors'][0]['value'] == ('release', 'abc123')

    def test_tag_value(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'tags': [('foo', 'b\nar'), ('biz', 'baz')],
        })
        assert data['tags'] == [('biz', 'baz')]
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'tags'
        assert data['errors'][0]['value'] == ('foo', 'b\nar')

    def test_extra_as_string(self):
        data = self.validate_and_normalize({
            'message': 'foo',
            'extra': 'bar',
        })
        assert data['extra'] == {}

    def test_release_too_long(self):
        data = self.validate_and_normalize({
            'release': 'a' * (VERSION_LENGTH + 1),
        })
        assert not data.get('release')
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'value_too_long'
        assert data['errors'][0]['name'] == 'release'
        assert data['errors'][0]['value'] == 'a' * (VERSION_LENGTH + 1)

    def test_release_as_non_string(self):
        data = self.validate_and_normalize({
            'release': 42,
        })
        assert data.get('release') == '42'

    def test_distribution_too_long(self):
        data = self.validate_and_normalize({
            'release': 'a' * 62,
            'dist': 'b' * 65,
        })
        assert not data.get('dist')
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'value_too_long'
        assert data['errors'][0]['name'] == 'dist'
        assert data['errors'][0]['value'] == 'b' * 65

    def test_distribution_bad_char(self):
        data = self.validate_and_normalize({
            'release': 'a' * 62,
            'dist': '^%',
        })
        assert not data.get('dist')
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'dist'
        assert data['errors'][0]['value'] == '^%'

    def test_distribution_strip(self):
        data = self.validate_and_normalize({
            'release': 'a' * 62,
            'dist': ' foo ',
        })
        assert data.get('dist') == 'foo'

    def test_distribution_as_non_string(self):
        data = self.validate_and_normalize({
            'release': '42',
            'dist': 23,
        })
        assert data.get('release') == '42'
        assert data.get('dist') == '23'

    def test_distribution_no_release(self):
        data = self.validate_and_normalize({
            'dist': 23,
        })
        assert data.get('dist') is None

    def test_valid_platform(self):
        data = self.validate_and_normalize({
            'platform': 'python',
        })
        assert data.get('platform') == 'python'

    def test_no_platform(self):
        data = self.validate_and_normalize({})
        assert data.get('platform') == 'other'

    def test_invalid_platform(self):
        data = self.validate_and_normalize({
            'platform': 'foobar',
        })
        assert data.get('platform') == 'other'

    def test_environment_too_long(self):
        data = self.validate_and_normalize({
            'environment': 'a' * 65,
        })
        assert not data.get('environment')
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'value_too_long'
        assert data['errors'][0]['name'] == 'environment'
        assert data['errors'][0]['value'] == 'a' * 65

    def test_environment_as_non_string(self):
        data = self.validate_and_normalize({
            'environment': 42,
        })
        assert data.get('environment') == '42'

    def test_time_spent_too_large(self):
        data = self.validate_and_normalize({
            'time_spent': 2147483647 + 1,
        })
        assert not data.get('time_spent')
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'value_too_long'
        assert data['errors'][0]['name'] == 'time_spent'
        assert data['errors'][0]['value'] == 2147483647 + 1

    def test_time_spent_invalid(self):
        data = self.validate_and_normalize({
            'time_spent': 'lol',
        })
        assert not data.get('time_spent')
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'time_spent'
        assert data['errors'][0]['value'] == 'lol'

    def test_time_spent_non_int(self):
        data = self.validate_and_normalize({
            'time_spent': '123',
        })
        assert data['time_spent'] == 123

    def test_fingerprints(self):
        data = self.validate_and_normalize({
            'fingerprint': '2012-01-01T10:30:45',
        })
        assert not data.get('fingerprint')
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'fingerprint'

        data = self.validate_and_normalize({
            'fingerprint': ['foo', ['bar']],
        })
        assert not data.get('fingerprint')
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'fingerprint'

        data = self.validate_and_normalize({
            'fingerprint': ['{{default}}', 1, 'bar', 4.5],
        })
        assert data.get('fingerprint') == ['{{default}}', '1', 'bar', '4.5']
        assert len(data['errors']) == 0

    def test_messages(self):
        # Just 'message': wrap it in interface
        data = self.validate_and_normalize({
            'message': 'foo is bar',
        })
        assert 'message' not in data
        assert data['sentry.interfaces.Message'] == {'message': 'foo is bar'}

        # both 'message' and interface with no 'formatted' value, put 'message'
        # into 'formatted'.
        data = self.validate_and_normalize({
            'message': 'foo is bar',
            'sentry.interfaces.Message': {
                'message': 'something else',
            }
        })
        assert 'message' not in data
        assert data['sentry.interfaces.Message'] == {
            'message': 'something else',
            'formatted': 'foo is bar'
        }

        # both 'message' and complete interface, 'message' is discarded
        data = self.validate_and_normalize({
            'message': 'foo is bar',
            'sentry.interfaces.Message': {
                'message': 'something else',
                'formatted': 'something else formatted',
            }
        })
        assert 'message' not in data
        assert len(data['errors']) == 0
        assert data['sentry.interfaces.Message'] == {
            'message': 'something else',
            'formatted': 'something else formatted'
        }

    @pytest.mark.skip(reason="Message behavior that didn't make a lot of sense.")
    def test_messages_old_behavior(self):
        # both 'message' and complete valid interface but interface has the same
        # value for both keys so the 'formatted' value is discarded and ends up
        # being replaced with 'message'
        data = self.validate_and_normalize({
            'message': 'foo is bar',
            'sentry.interfaces.Message': {
                'message': 'something else',
                'formatted': 'something else',
            }
        })
        assert 'message' not in data
        assert len(data['errors']) == 0
        assert data['sentry.interfaces.Message'] == {
            'message': 'something else',
            'formatted': 'foo is bar'
        }

        # interface discarded as invalid, replaced by new interface containing
        # wrapped 'message'
        data = self.validate_and_normalize({
            'message': 'foo is bar',
            'sentry.interfaces.Message': {
                'invalid': 'invalid',
            }
        })
        assert 'message' not in data
        assert len(data['errors']) == 1
        assert data['sentry.interfaces.Message'] == {
            'message': 'foo is bar'
        }


class SafelyLoadJSONStringTest(BaseAPITest):
    def test_valid_payload(self):
        data = self.helper.safely_load_json_string('{"foo": "bar"}')
        assert data == {'foo': 'bar'}

    def test_invalid_json(self):
        with self.assertRaises(APIError):
            self.helper.safely_load_json_string('{')

    def test_unexpected_type(self):
        with self.assertRaises(APIError):
            self.helper.safely_load_json_string('1')


class DecodeDataTest(BaseAPITest):
    def test_valid_data(self):
        data = self.helper.decode_data('foo')
        assert data == u'foo'
        assert type(data) == six.text_type

    def test_invalid_data(self):
        with self.assertRaises(APIError):
            self.helper.decode_data('\x99')


class GetInterfaceTest(TestCase):
    def test_does_not_let_through_disallowed_name(self):
        with self.assertRaises(ValueError):
            get_interface('subprocess')

    def test_allows_http(self):
        from sentry.interfaces.http import Http
        result = get_interface('sentry.interfaces.Http')
        assert result is Http
        result = get_interface('request')
        assert result is Http


class EnsureHasIpTest(BaseAPITest):
    def test_with_remote_addr(self):
        inp = {
            'sentry.interfaces.Http': {
                'url': 'http://example.com/',
                'env': {
                    'REMOTE_ADDR': '192.168.0.1',
                },
            },
        }
        out = inp.copy()
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.Http']['env']['REMOTE_ADDR'] == '192.168.0.1'

    def test_with_user_ip(self):
        inp = {
            'sentry.interfaces.User': {
                'ip_address': '192.168.0.1',
            },
        }
        out = inp.copy()
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.User']['ip_address'] == '192.168.0.1'

    def test_with_user_auto_ip(self):
        out = {
            'sentry.interfaces.User': {
                'ip_address': '{{auto}}',
            },
        }
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.User']['ip_address'] == '127.0.0.1'

        out = {
            'user': {
                'ip_address': '{{auto}}',
            },
        }
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.User']['ip_address'] == '127.0.0.1'

    def test_without_ip_values(self):
        out = {
            'platform': 'javascript',
            'sentry.interfaces.User': {},
            'sentry.interfaces.Http': {
                'url': 'http://example.com/',
                'env': {},
            },
        }
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.User']['ip_address'] == '127.0.0.1'

    def test_without_any_values(self):
        out = {
            'platform': 'javascript',
        }
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.User']['ip_address'] == '127.0.0.1'

    def test_with_http_auto_ip(self):
        out = {
            'sentry.interfaces.Http': {
                'url': 'http://example.com/',
                'env': {
                    'REMOTE_ADDR': '{{auto}}',
                },
            },
        }
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.Http']['env']['REMOTE_ADDR'] == '127.0.0.1'

    def test_with_all_auto_ip(self):
        out = {
            'sentry.interfaces.User': {
                'ip_address': '{{auto}}',
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com/',
                'env': {
                    'REMOTE_ADDR': '{{auto}}',
                },
            },
        }
        self.validate_and_normalize(out, {'client_ip': '127.0.0.1'})
        assert out['sentry.interfaces.Http']['env']['REMOTE_ADDR'] == '127.0.0.1'
        assert out['sentry.interfaces.User']['ip_address'] == '127.0.0.1'


class SecurityApiHelperTest(BaseAPITest):
    helper_cls = SecurityApiHelper

    def test_csp_validate_basic(self):
        report = {
            "release": "abc123",
            "interface": 'sentry.interfaces.Csp',
            "report": {
                "csp-report": {
                    "document-uri": "http://45.55.25.245:8123/csp",
                    "referrer": "http://example.com",
                    "violated-directive": "img-src https://45.55.25.245:8123/",
                    "effective-directive": "img-src",
                    "original-policy": "default-src  https://45.55.25.245:8123/; child-src  https://45.55.25.245:8123/; connect-src  https://45.55.25.245:8123/; font-src  https://45.55.25.245:8123/; img-src  https://45.55.25.245:8123/; media-src  https://45.55.25.245:8123/; object-src  https://45.55.25.245:8123/; script-src  https://45.55.25.245:8123/; style-src  https://45.55.25.245:8123/; form-action  https://45.55.25.245:8123/; frame-ancestors 'none'; plugin-types 'none'; report-uri http://45.55.25.245:8123/csp-report?os=OS%20X&device=&browser_version=43.0&browser=chrome&os_version=Lion",
                    "blocked-uri": "http://google.com",
                    "status-code": 200,
                }
            }
        }
        result = self.validate_and_normalize(report)
        assert result['logger'] == 'csp'
        assert result['release'] == 'abc123'
        assert result['errors'] == []
        assert 'sentry.interfaces.Message' in result
        assert 'culprit' in result
        assert result['tags'] == [
            ('effective-directive', 'img-src'),
            ('blocked-uri', 'http://google.com'),
        ]
        assert result['sentry.interfaces.User'] == {'ip_address': '198.51.100.0'}
        assert result['sentry.interfaces.Http']['url'] == 'http://45.55.25.245:8123/csp'
        assert dict(result['sentry.interfaces.Http']['headers']) == {
            'User-Agent': 'Awesome Browser',
            'Referer': 'http://example.com'
        }

    def test_csp_validate_failure(self):
        report = {
            "release": "abc123",
            "interface": 'sentry.interfaces.Csp',
            "report": {}
        }
        with self.assertRaises(APIError):
            self.validate_and_normalize(report)

        with self.assertRaises(APIError):
            self.validate_and_normalize({})

    def test_csp_tags_out_of_bounds(self):
        report = {
            "release": "abc123",
            "interface": 'sentry.interfaces.Csp',
            "report": {
                "csp-report": {
                    "document-uri": "http://45.55.25.245:8123/csp",
                    "referrer": "http://example.com",
                    "violated-directive": "img-src https://45.55.25.245:8123/",
                    "effective-directive": "img-src",
                    "original-policy": "default-src  https://45.55.25.245:8123/; child-src  https://45.55.25.245:8123/; connect-src  https://45.55.25.245:8123/; font-src  https://45.55.25.245:8123/; img-src  https://45.55.25.245:8123/; media-src  https://45.55.25.245:8123/; object-src  https://45.55.25.245:8123/; script-src  https://45.55.25.245:8123/; style-src  https://45.55.25.245:8123/; form-action  https://45.55.25.245:8123/; frame-ancestors 'none'; plugin-types 'none'; report-uri http://45.55.25.245:8123/csp-report?os=OS%20X&device=&browser_version=43.0&browser=chrome&os_version=Lion",
                    "blocked-uri": "v" * 201,
                    "status-code": 200,
                }
            }
        }
        result = self.validate_and_normalize(report)
        assert result['tags'] == [
            ('effective-directive', 'img-src'),
        ]
        assert len(result['errors']) == 1

    def test_csp_tag_value(self):
        report = {
            "release": "abc123",
            "interface": 'sentry.interfaces.Csp',
            "report": {
                "csp-report": {
                    "document-uri": "http://45.55.25.245:8123/csp",
                    "referrer": "http://example.com",
                    "violated-directive": "img-src https://45.55.25.245:8123/",
                    "effective-directive": "img-src",
                    "original-policy": "default-src  https://45.55.25.245:8123/; child-src  https://45.55.25.245:8123/; connect-src  https://45.55.25.245:8123/; font-src  https://45.55.25.245:8123/; img-src  https://45.55.25.245:8123/; media-src  https://45.55.25.245:8123/; object-src  https://45.55.25.245:8123/; script-src  https://45.55.25.245:8123/; style-src  https://45.55.25.245:8123/; form-action  https://45.55.25.245:8123/; frame-ancestors 'none'; plugin-types 'none'; report-uri http://45.55.25.245:8123/csp-report?os=OS%20X&device=&browser_version=43.0&browser=chrome&os_version=Lion",
                    "blocked-uri": "http://google.com",
                    "status-code": 200,
                }
            }
        }
        result = self.validate_and_normalize(report)
        assert result['tags'] == [
            ('effective-directive', 'img-src'),
            ('blocked-uri', 'http://google.com'),
        ]
        assert len(result['errors']) == 0
