# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from sentry.constants import MEMBER_USER
from sentry.models import Project
from sentry.web.helpers import get_project_list, get_login_url, group_is_public
from sentry.testutils import TestCase


class GetProjectListTEst(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="admin", email="admin@localhost")
        self.project = Project.objects.get()
        self.project.update(public=True)
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


class GetLoginUrlTest(TestCase):
    def test_as_path(self):
        with self.Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

    def test_as_lazy_url(self):
        with self.Settings(LOGIN_URL=reverse('sentry-fake-login')):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-fake-login'))

    def test_cached(self):
        # should still be cached
        with self.Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(False)
            self.assertNotEquals(url, '/really-a-404')

    def test_no_value(self):
        with self.Settings(SENTRY_LOGIN_URL=None):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))


class GroupIsPublicTest(TestCase):
    @mock.patch('sentry.web.helpers.get_project_list', mock.Mock(return_value={}))
    def test_non_public_group_returns_false(self):
        self.group.is_public = False
        self.user.is_superuser = False
        result = group_is_public(self.group, self.user)
        assert result is False

    @mock.patch('sentry.web.helpers.get_project_list')
    def test_public_group_returns_true_with_missing_project(self, get_project_list):
        get_project_list.return_value = {}
        self.group.is_public = True
        self.user.is_superuser = False
        result = group_is_public(self.group, self.user)
        assert result is True
        get_project_list.assert_called_once_with(self.user)

    @mock.patch('sentry.web.helpers.get_project_list')
    def test_public_group_returns_false_with_project_membership(self, get_project_list):
        get_project_list.return_value = {self.group.project.id: self.group.project}
        self.group.is_public = True
        self.user.is_superuser = False
        result = group_is_public(self.group, self.user)
        assert result is False
        get_project_list.assert_called_once_with(self.user)

    @mock.patch('sentry.web.helpers.get_project_list', mock.Mock(return_value={}))
    def test_superuser_is_false_with_missing_project(self):
        self.group.is_public = True
        self.user.is_superuser = True
        result = group_is_public(self.group, self.user)
        assert result is False
