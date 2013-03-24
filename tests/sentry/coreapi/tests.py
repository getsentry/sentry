# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import mock

from django.contrib.auth.models import User

from sentry.models import Project
from sentry.exceptions import InvalidTimestamp
from sentry.coreapi import (project_from_id, project_from_api_key_and_id,
    extract_auth_vars, project_from_auth_vars, APIUnauthorized, APIForbidden,
    process_data_timestamp, validate_data, INTERFACE_ALIASES)
from sentry.testutils import TestCase


class BaseAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='coreapi')
        self.project = Project.objects.create(owner=self.user, name='Foo', slug='bar')
        self.pm = self.project.team.member_set.get_or_create(user=self.user)[0]
        self.pk = self.project.key_set.get_or_create(user=self.user)[0]


class InterfaceAliasesTest(BaseAPITest):
    def test_http(self):
        assert INTERFACE_ALIASES['request'] == 'sentry.interfaces.Http'

    def test_user(self):
        assert INTERFACE_ALIASES['user'] == 'sentry.interfaces.User'

    def test_exception(self):
        assert INTERFACE_ALIASES['exception'] == 'sentry.interfaces.Exception'

    def test_stacktrace(self):
        assert INTERFACE_ALIASES['stacktrace'] == 'sentry.interfaces.Stacktrace'

    def test_template(self):
        assert INTERFACE_ALIASES['template'] == 'sentry.interfaces.Template'


class ProjectFromIdTest(BaseAPITest):
    def test_valid(self):
        request = mock.Mock()
        request.user = self.user
        request.GET = {'project_id': self.project.id}

        project = project_from_id(request)

        self.assertEquals(project, self.project)

    def test_invalid_project_id(self):
        request = mock.Mock()
        request.user = self.user
        request.GET = {'project_id': 10000}

        self.assertRaises(APIUnauthorized, project_from_id, request)

    def test_inactive_user(self):
        request = mock.Mock()
        request.user = self.user
        request.user.is_active = False
        request.GET = {'project_id': self.project.id}

        self.assertRaises(APIUnauthorized, project_from_id, request)

    def test_inactive_member(self):
        request = mock.Mock()
        request.user = self.user
        request.GET = {'project_id': self.project.id}

        self.pm.is_active = False
        self.pm.save()

        self.assertRaises(APIUnauthorized, project_from_id, request)


class ProjectFromApiKeyAndIdTest(BaseAPITest):
    def test_valid(self):
        api_key = self.pk.public_key
        project = project_from_api_key_and_id(api_key, self.project.id)
        self.assertEquals(project, self.project)

    def test_invalid_project_id(self):
        self.assertRaises(APIUnauthorized, project_from_api_key_and_id, self.pk.public_key, 10000)

    def test_invalid_api_key(self):
        self.assertRaises(APIUnauthorized, project_from_api_key_and_id, 1, self.project.id)

    def test_inactive_user(self):
        user = self.pm.user
        user.is_active = False
        user.save()

        self.assertRaises(APIUnauthorized, project_from_api_key_and_id, self.pk.public_key, self.project.id)

    def test_inactive_member(self):
        self.pm.is_active = False
        self.pm.save()

        self.assertRaises(APIUnauthorized, project_from_api_key_and_id, self.pk.public_key, self.project.id)


class ExtractAuthVarsTest(BaseAPITest):
    def test_valid(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry key=value, biz=baz'}
        result = extract_auth_vars(request)
        self.assertNotEquals(result, None)
        self.assertTrue('key' in result)
        self.assertEquals(result['key'], 'value')
        self.assertTrue('biz' in result)
        self.assertEquals(result['biz'], 'baz')

    def test_invalid_header_defers_to_GET(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'foobar'}
        result = extract_auth_vars(request)
        self.assertEquals(result, request.GET)

    def test_valid_version_legacy(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'Sentry key=value, biz=baz'}
        result = extract_auth_vars(request)
        self.assertNotEquals(result, None)
        self.assertTrue('key' in result)
        self.assertEquals(result['key'], 'value')
        self.assertTrue('biz' in result)
        self.assertEquals(result['biz'], 'baz')

    def test_invalid_legacy_header_defers_to_GET(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'foobar'}
        result = extract_auth_vars(request)
        self.assertEquals(result, request.GET)


class ProjectFromAuthVarsTest(BaseAPITest):
    def test_invalid_if_missing_key(self):
        auth_vars = {}
        self.assertRaises(APIForbidden, project_from_auth_vars, auth_vars)

    def test_valid_with_key(self):
        auth_vars = {'sentry_key': self.pk.public_key}
        result = project_from_auth_vars(auth_vars)
        self.assertEquals(result, (self.project, self.pk.user))

    def test_inactive_user(self):
        user = self.pm.user
        user.is_active = False
        user.save()

        auth_vars = {'sentry_key': self.pk.public_key}
        self.assertRaises(APIUnauthorized, project_from_auth_vars, auth_vars)

    def test_inactive_member(self):
        self.pm.is_active = False
        self.pm.save()

        auth_vars = {'sentry_key': self.pk.public_key}
        self.assertRaises(APIUnauthorized, project_from_auth_vars, auth_vars)

    def test_invalid_key(self):
        auth_vars = {'sentry_key': 'z'}
        self.assertRaises(APIForbidden, project_from_auth_vars, auth_vars)

    def test_invalid_secret(self):
        auth_vars = {'sentry_key': self.pk.public_key, 'sentry_secret': 'z'}
        self.assertRaises(APIForbidden, project_from_auth_vars, auth_vars)


class ProcessDataTimestampTest(BaseAPITest):
    def test_iso_timestamp(self):
        data = process_data_timestamp({
            'timestamp': '2012-01-01T10:30:45'
        })
        d = datetime.datetime(2012, 01, 01, 10, 30, 45)
        self.assertTrue('timestamp' in data)
        self.assertEquals(data['timestamp'], d)

    def test_iso_timestamp_with_ms(self):
        data = process_data_timestamp({
            'timestamp': '2012-01-01T10:30:45.434'
        })
        d = datetime.datetime(2012, 01, 01, 10, 30, 45, 434000)
        self.assertTrue('timestamp' in data)
        self.assertEquals(data['timestamp'], d)

    def test_timestamp_iso_timestamp_with_Z(self):
        data = process_data_timestamp({
            'timestamp': '2012-01-01T10:30:45Z'
        })
        d = datetime.datetime(2012, 01, 01, 10, 30, 45)
        self.assertTrue('timestamp' in data)
        self.assertEquals(data['timestamp'], d)

    def test_invalid_timestamp(self):
        self.assertRaises(InvalidTimestamp, process_data_timestamp, {
            'timestamp': 'foo'
        })

    def test_invalid_numeric_timestamp(self):
        self.assertRaises(InvalidTimestamp, process_data_timestamp, {
            'timestamp': '100000000000000000000.0'
        })

    def test_future_timestamp(self):
        self.assertRaises(InvalidTimestamp, process_data_timestamp, {
            'timestamp': '2052-01-01T10:30:45Z'
        })


class ValidateDataTest(BaseAPITest):
    def test_missing_project_id(self):
        data = validate_data(self.project, {
            'message': 'foo',
        })
        assert data['project'] == self.project.id

    @mock.patch('uuid.uuid4')
    def test_empty_event_id(self, uuid4):
        data = validate_data(self.project, {
            'event_id': '',
        })
        assert data['event_id'] == uuid4.return_value.hex

    @mock.patch('uuid.uuid4')
    def test_missing_event_id(self, uuid4):
        data = validate_data(self.project, {})
        assert data['event_id'] == uuid4.return_value.hex

    @mock.patch('uuid.uuid4')
    def test_invalid_event_id(self, uuid4):
        data = validate_data(self.project, {
            'event_id': 'a' * 33,
        })
        assert data['event_id'] == uuid4.return_value.hex

    def test_invalid_project_id(self):
        with self.assertRaises(APIForbidden):
            validate_data(self.project, {
                'project': self.project.id + 1,
                'message': 'foo',
            })

    def test_unknown_attribute(self):
        data = validate_data(self.project, {
            'message': 'foo',
            'foo': 'bar',
        })
        assert 'foo' not in data

    def test_invalid_interface_name(self):
        data = validate_data(self.project, {
            'message': 'foo',
            'foo.baz': 'bar',
        })
        assert 'foo.baz' not in data

    def test_invalid_interface_import_path(self):
        data = validate_data(self.project, {
            'message': 'foo',
            'sentry.interfaces.Exception2': 'bar',
        })
        assert 'sentry.interfaces.Exception2' not in data

    def test_invalid_interface_args(self):
        data = validate_data(self.project, {
            'message': 'foo',
            'tests.manager.tests.DummyInterface': {'foo': 'bar'}
        })
        assert 'tests.manager.tests.DummyInterface' not in data

    @mock.patch('sentry.coreapi.import_string')
    def test_an_alias_maps_correctly(self, import_string):
        alias, full_path = INTERFACE_ALIASES.items()[0]

        result = validate_data(self.project, {
            'project': self.project.id,
            'message': 'foo',
            alias: {'foo': 'bar'},
        })
        import_string.assert_called_once_with(full_path)
        interface = import_string.return_value
        interface.assert_called_once_with(foo='bar')
        assert alias not in result
        assert full_path in result
        assert result[full_path] == interface.return_value.serialize.return_value

    def test_log_level_as_string(self):
        data = validate_data(self.project, {
            'message': 'foo',
            'level': 'error',
        })
        assert data['level'] == 40

    def test_invalid_log_level(self):
        data = validate_data(self.project, {
            'message': 'foo',
            'level': 'foobar',
        })
        assert data['level'] == 40

    def test_project_slug(self):
        data = validate_data(self.project, {
            'project': self.project.slug,
            'message': 'foo',
        })
        assert data['project'] == self.project.id
