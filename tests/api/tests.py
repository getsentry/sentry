# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import time

from django.contrib.auth.models import User

from sentry.models import Project
from sentry.coreapi import project_from_id, project_from_api_key_and_id, \
  extract_auth_vars, project_from_auth_vars, validate_hmac, APIUnauthorized, \
  APIForbidden, APITimestampExpired, APIError
from sentry.utils.auth import get_signature

from tests.base import TestCase


class APITest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='coreapi')
        self.project = Project.objects.get(id=1)
        self.pm = self.project.member_set.create(user=self.user)

    def test_get_signature(self):
        self.assertEquals(get_signature('x', 'y', 'z'), '77e1f5656ddc2e93f64469cc18f9f195fe665428')
        self.assertEquals(get_signature(u'x', u'y', u'z'), '77e1f5656ddc2e93f64469cc18f9f195fe665428')

    def test_valid_project_from_id(self):
        request = mock.Mock()
        request.user = self.user
        request.GET = {'project_id': self.project.id}

        project = project_from_id(request)

        self.assertEquals(project, self.project)

    def test_invalid_project_from_id(self):
        request = mock.Mock()
        request.user = self.user
        request.GET = {'project_id': 10000}

        with self.assertRaises(APIUnauthorized):
            project_from_id(request)

    def test_valid_project_from_api_key_and_id(self):
        api_key = self.pm.public_key
        project = project_from_api_key_and_id(api_key, self.project)
        self.assertEquals(project, self.project)

    def test_invalid_project_from_api_key_and_id(self):
        api_key = self.pm.public_key

        # invalid project_id
        with self.assertRaises(APIUnauthorized):
            project_from_api_key_and_id(api_key, 10000)

        # invalid api_key
        with self.assertRaises(APIUnauthorized):
            project_from_api_key_and_id(1, self.project.id)

    def test_valid_extract_auth_vars_v3(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry key=value, biz=baz'}
        result = extract_auth_vars(request)
        self.assertNotEquals(result, None)
        self.assertTrue('key' in result)
        self.assertEquals(result['key'], 'value')
        self.assertTrue('biz' in result)
        self.assertEquals(result['biz'], 'baz')

    def test_invalid_extract_auth_vars_v3(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'foobar'}
        result = extract_auth_vars(request)
        self.assertEquals(result, None)

    def test_valid_extract_auth_vars_v2(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'Sentry key=value, biz=baz'}
        result = extract_auth_vars(request)
        self.assertNotEquals(result, None)
        self.assertTrue('key' in result)
        self.assertEquals(result['key'], 'value')
        self.assertTrue('biz' in result)
        self.assertEquals(result['biz'], 'baz')

    def test_invalid_extract_auth_vars_v2(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'foobar'}
        result = extract_auth_vars(request)
        self.assertEquals(result, None)

    def test_valid_project_from_auth_vars_without_key(self):
        auth_vars = {
            'sentry_signature': 'adf',
            'sentry_timestamp': time.time(),
        }
        with mock.patch('sentry.coreapi.validate_hmac') as validate_hmac:
            validate_hmac.return_value = True

            # without key
            result = project_from_auth_vars(auth_vars, '')
            self.assertEquals(result, None)

            # with key
            auth_vars['sentry_key'] = self.pm.public_key
            result = project_from_auth_vars(auth_vars, '')
            self.assertEquals(result, self.project)

    def test_valid_validate_hmac(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'signature'

            validate_hmac('foo', 'signature', time.time(), 'foo')

    def test_invalid_validate_hmac_signature(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'notsignature'

            with self.assertRaises(APIForbidden):
                validate_hmac('foo', 'signature', time.time(), 'foo')

    def test_invalid_validate_hmac_expired(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'signature'

            with self.assertRaises(APITimestampExpired):
                validate_hmac('foo', 'signature', time.time() - 3601, 'foo')

    def test_invalid_validate_hmac_bad_timestamp(self):
        with mock.patch('sentry.coreapi.get_signature') as get_signature:
            get_signature.return_value = 'signature'

            with self.assertRaises(APIError):
                validate_hmac('foo', 'signature', 'foo', 'foo')
