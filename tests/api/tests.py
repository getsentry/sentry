# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.contrib.auth.models import User

from sentry.models import Project
from sentry.coreapi import project_from_id, project_from_api_key_and_id, \
  APIUnauthorized

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
