# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.contrib.auth.models import User
from sentry.constants import MEMBER_USER
from sentry.models import Project
from sentry.web.helpers import get_project_list
from tests.base import TestCase


class GetProjectListTEst(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="admin", email="admin@localhost")
        self.project = Project.objects.get()
        assert self.project.public is True
        self.project2 = Project.objects.create(name='Test', slug='test', owner=self.user, public=False)

    @mock.patch('sentry.models.Team.objects.get_for_user', mock.Mock(return_value={}))
    def test_includes_public_projects_without_access(self):
        project_list = get_project_list(self.user)
        self.assertEquals(len(project_list), 1)
        self.assertIn(self.project.id, project_list)

    @mock.patch('sentry.models.Team.objects.get_for_user', mock.Mock(return_value={}))
    def test_does_exclude_public_projects_without_access(self):
        project_list = get_project_list(self.user, MEMBER_USER)
        self.assertEquals(len(project_list), 0)

    @mock.patch('sentry.models.Team.objects.get_for_user')
    def test_does_include_private_projects_without_access(self, get_for_user):
        get_for_user.return_value = {self.project2.team.id: self.project2.team}
        project_list = get_project_list(self.user)
        get_for_user.assert_called_once_with(self.user, None)
        self.assertEquals(len(project_list), 2)
        self.assertIn(self.project.id, project_list)
        self.assertIn(self.project2.id, project_list)

    @mock.patch('sentry.models.Team.objects.get_for_user')
    def test_does_exclude_public_projects_but_include_private_with_access(self, get_for_user):
        get_for_user.return_value = {self.project2.team.id: self.project2.team}
        project_list = get_project_list(self.user, MEMBER_USER)
        get_for_user.assert_called_once_with(self.user, MEMBER_USER)
        self.assertEquals(len(project_list), 1)
        self.assertIn(self.project2.id, project_list)
