# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.contrib.auth.models import User

from sentry.models import Project
from sentry.coreapi import project_from_id, project_from_api_key_and_id, \
  extract_auth_vars, APIUnauthorized

from tests.base import TestCase


class APITest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='coreapi')
        self.project = Project.objects.get(id=1)
        self.pm = self.project.member_set.create(user=self.user)

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
