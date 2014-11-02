# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.contrib.auth.models import AnonymousUser
from django.core.urlresolvers import reverse
from sentry.web.helpers import get_login_url, group_is_public, get_raven_js_url
from sentry.testutils import TestCase


class GetLoginUrlTest(TestCase):
    def test_as_path(self):
        with self.settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

    def test_as_lazy_url(self):
        with self.settings(LOGIN_URL=reverse('sentry-fake-login')):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-fake-login'))

    def test_cached(self):
        # should still be cached
        with self.settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(False)
            self.assertNotEquals(url, '/really-a-404')

    def test_no_value(self):
        with self.settings(SENTRY_LOGIN_URL=None):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))


class GroupIsPublicTest(TestCase):
    @mock.patch('sentry.models.Project.objects.get_for_user')
    def test_non_public_group_returns_false(self, get_project_list):
        get_project_list.return_value = []
        self.group.is_public = False
        self.user.is_superuser = False
        result = group_is_public(self.group, self.user)
        assert result is False

    @mock.patch('sentry.models.Project.objects.get_for_user')
    def test_public_group_returns_true_with_missing_project(self, get_project_list):
        get_project_list.return_value = []
        self.group.is_public = True
        self.user.is_superuser = False
        result = group_is_public(self.group, self.user)
        assert result is True
        get_project_list.assert_called_once_with(team=self.group.project.team, user=self.user)

    @mock.patch('sentry.models.Project.objects.get_for_user')
    def test_public_group_returns_false_with_project_membership(self, get_project_list):
        get_project_list.return_value = [self.group.project]
        self.group.is_public = True
        self.user.is_superuser = False
        result = group_is_public(self.group, self.user)
        assert result is False
        get_project_list.assert_called_once_with(team=self.group.project.team, user=self.user)

    @mock.patch('sentry.models.Project.objects.get_for_user')
    def test_superuser_is_false_with_missing_project(self, get_project_list):
        get_project_list.return_value = []
        self.group.is_public = True
        self.user.is_superuser = True
        result = group_is_public(self.group, self.user)
        assert result is False

    @mock.patch('sentry.models.Project.objects.get_for_user')
    def test_anonymous_user(self, get_project_list):
        get_project_list.return_value = []
        self.group.is_public = True
        result = group_is_public(self.group, AnonymousUser())
        assert result is True


class GetRavenJsUrl(TestCase):
    def test_with_custom_raven_js_url(self):
        url = 'my.cdn/1.0/raven.min.js'
        with self.settings(SENTRY_RAVEN_JS_URL=url):
            self.assertEquals(get_raven_js_url(), url)

    def test_with_default_raven_js_url(self):
        self.assertEquals(get_raven_js_url(), 'cdn.ravenjs.com/1.1.15/jquery,native/raven.min.js')
