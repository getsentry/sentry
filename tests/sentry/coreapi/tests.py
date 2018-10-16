# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six
import mock
import pytest

from django.core.exceptions import SuspiciousOperation

from sentry.coreapi import (
    APIError,
    APIUnauthorized,
    Auth,
    ClientApiHelper,
)
from sentry.interfaces.base import get_interface
from sentry.testutils import TestCase


class BaseAPITest(TestCase):
    helper_cls = ClientApiHelper

    def setUp(self):
        self.user = self.create_user('coreapi@example.com')
        self.team = self.create_team(name='Foo')
        self.project = self.create_project(teams=[self.team])
        self.pk = self.project.key_set.get_or_create()[0]
        self.helper = self.helper_cls(agent='Awesome Browser', ip_address='198.51.100.0')


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
        assert isinstance(data, six.text_type)

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
