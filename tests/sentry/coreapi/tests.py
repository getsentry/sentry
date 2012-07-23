# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import mock
import time

from django.contrib.auth.models import User

from sentry.models import Project
from sentry.exceptions import InvalidTimestamp, InvalidInterface, InvalidData
from sentry.coreapi import project_from_id, project_from_api_key_and_id, \
  extract_auth_vars, project_from_auth_vars, validate_hmac, APIUnauthorized, \
  APIForbidden, APITimestampExpired, APIError, process_data_timestamp, \
  insert_data_to_database, validate_data
from sentry.utils.auth import get_signature

from tests.base import TestCase


class BaseAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='coreapi')
        self.project = Project.objects.create(owner=self.user, name='Foo', slug='bar')
        self.pm = self.project.team.member_set.get_or_create(user=self.user)[0]
        self.pk = self.project.key_set.get_or_create(user=self.user)[0]


class GetSignatureTest(BaseAPITest):
    def test_valid_string(self):
        self.assertEquals(get_signature('x', 'y', 'z'), '77e1f5656ddc2e93f64469cc18f9f195fe665428')

    def test_valid_unicode(self):
        self.assertEquals(get_signature(u'x', u'y', u'z'), '77e1f5656ddc2e93f64469cc18f9f195fe665428')


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

    def test_invalid_construct(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'foobar'}
        result = extract_auth_vars(request)
        self.assertEquals(result, None)

    def test_valid_version_legacy(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'Sentry key=value, biz=baz'}
        result = extract_auth_vars(request)
        self.assertNotEquals(result, None)
        self.assertTrue('key' in result)
        self.assertEquals(result['key'], 'value')
        self.assertTrue('biz' in result)
        self.assertEquals(result['biz'], 'baz')

    def test_invalid_construct_legacy(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'foobar'}
        result = extract_auth_vars(request)
        self.assertEquals(result, None)


class ProjectFromAuthVarsTest(BaseAPITest):
    def test_valid_without_key(self):
        auth_vars = {
            'sentry_signature': 'adf',
            'sentry_timestamp': time.time(),
        }
        with mock.patch('sentry.coreapi.validate_hmac') as validate_hmac_:
            validate_hmac_.return_value = True

            # without key
            result = project_from_auth_vars(auth_vars, '')
            self.assertEquals(result, None)

            # with key
            auth_vars['sentry_key'] = self.pk.public_key
            result = project_from_auth_vars(auth_vars, '')
            self.assertEquals(result, self.project)

    def test_inactive_user(self):
        user = self.pm.user
        user.is_active = False
        user.save()

        auth_vars = {
            'sentry_signature': 'adf',
            'sentry_timestamp': time.time(),
        }
        with mock.patch('sentry.coreapi.validate_hmac') as validate_hmac_:
            validate_hmac_.return_value = True

            # without key
            result = project_from_auth_vars(auth_vars, '')
            self.assertEquals(result, None)

            # with key
            auth_vars['sentry_key'] = self.pk.public_key
            self.assertRaises(APIUnauthorized, project_from_auth_vars, auth_vars, '')

    def test_inactive_member(self):
        self.pm.is_active = False
        self.pm.save()

        auth_vars = {
            'sentry_signature': 'adf',
            'sentry_timestamp': time.time(),
        }
        with mock.patch('sentry.coreapi.validate_hmac') as validate_hmac_:
            validate_hmac_.return_value = True

            # without key
            result = project_from_auth_vars(auth_vars, '')
            self.assertEquals(result, None)

            # with key
            auth_vars['sentry_key'] = self.pk.public_key
            self.assertRaises(APIUnauthorized, project_from_auth_vars, auth_vars, '')


class ValidateHmacTest(BaseAPITest):
    def test_valid(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'signature'

            validate_hmac('foo', 'signature', time.time(), 'foo')

    def test_invalid_signature(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'notsignature'

            self.assertRaises(APIForbidden, validate_hmac, 'foo', 'signature', time.time(), 'foo')

    def test_timestamp_expired(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'signature'

            self.assertRaises(APITimestampExpired, validate_hmac, 'foo', 'signature', time.time() - 3601, 'foo')

    def test_invalid_timestamp(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'signature'

            self.assertRaises(APIError, validate_hmac, 'foo', 'signature', 'foo', 'foo')


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


class InsertDataToDatabaseTest(BaseAPITest):
    @mock.patch('sentry.models.Group.objects.from_kwargs')
    def test_insert_data_to_database(self, from_kwargs):
        insert_data_to_database({
            'foo': 'bar'
        })
        from_kwargs.assert_called_once_with(foo='bar')


class ValidateDataTest(BaseAPITest):
    def test_missing_project_id(self):
        self.assertRaises(APIForbidden, validate_data, self.project, {
            'message': 'foo',
        })

    def test_invalid_project_id(self):
        self.assertRaises(APIForbidden, validate_data, self.project, {
            'project': self.project.id + 1,
            'message': 'foo',
        })

    def test_invalid_interface_name(self):
        self.assertRaises(InvalidInterface, validate_data, self.project, {
            'project': self.project.id,
            'message': 'foo',
            'foo': 'bar',
        })

    def test_invalid_interface_import_path(self):
        self.assertRaises(InvalidInterface, validate_data, self.project, {
            'project': self.project.id,
            'message': 'foo',
            'sentry.interfaces.Exception2': 'bar',
        })

    def test_invalid_interface_args(self):
        self.assertRaises(InvalidData, validate_data, self.project, {
            'project': self.project.id,
            'message': 'foo',
            'tests.manager.tests.DummyInterface': {'foo': 'bar'}
        })

    def test_log_level_as_string(self):
        data = validate_data(self.project, {
            'project': self.project.id,
            'message': 'foo',
            'level': 'error',
        })
        self.assertEquals(data['level'], 40)

    def test_project_slug(self):
        data = validate_data(self.project, {
            'project': self.project.slug,
            'message': 'foo',
        })
        self.assertEquals(data['project'], self.project.id)
