# -*- coding: utf-8 -*-

from __future__ import absolute_import

import json
import mock

from social_auth.models import UserSocialAuth

from sentry.models import User, GroupMeta
from sentry.plugins import IssueTrackingPlugin, IssueTrackingPlugin2, plugins
from sentry.testutils import TestCase


class GetAuthForUserTest(TestCase):
    def _get_mock_user(self):
        user = mock.Mock(spec=User())
        user.id = 1
        user.is_authenticated.return_value = False
        return user

    def test_requires_auth_provider(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin()
        self.assertRaises(AssertionError, p.get_auth_for_user, user)

    def test_returns_none_on_missing_identity(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin()
        p.auth_provider = 'test'
        self.assertEquals(p.get_auth_for_user(user), None)

    def test_returns_identity(self):
        user = User.objects.create(username='test', email='test@example.com')
        auth = UserSocialAuth.objects.create(provider='test', user=user)
        p = IssueTrackingPlugin()
        p.auth_provider = 'test'
        self.assertEquals(p.get_auth_for_user(user), auth)


class GetAuthForUserTestIssue2(TestCase):
    def _get_mock_user(self):
        user = mock.Mock(spec=User())
        user.id = 1
        user.is_authenticated.return_value = False
        return user

    def test_requires_auth_provider(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin2()
        self.assertRaises(AssertionError, p.get_auth_for_user, user)

    def test_returns_none_on_missing_identity(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin2()
        p.auth_provider = 'test'
        self.assertEquals(p.get_auth_for_user(user), None)

    def test_returns_identity(self):
        user = User.objects.create(username='test', email='test@example.com')
        auth = UserSocialAuth.objects.create(provider='test', user=user)
        p = IssueTrackingPlugin2()
        p.auth_provider = 'test'
        self.assertEquals(p.get_auth_for_user(user), auth)


class IssuePlugin2GroupAction(TestCase):

    def setUp(self):
        super(IssuePlugin2GroupAction, self).setUp()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)
        self.plugin_instance = plugins.get(slug='issuetrackingplugin2')
        self.event = self.create_event(
            event_id='a',
            group=self.group,
        )

    @mock.patch('sentry.plugins.IssueTrackingPlugin2.is_configured', return_value=True)
    def test_get_create(self, *args):
        self.login_as(user=self.user)
        url = '/api/0/issues/%s/plugins/issuetrackingplugin2/create/' % self.group.id
        response = self.client.get(url, format='json')
        content = json.loads(response.content)
        field_names = [field['name'] for field in content]
        assert response.status_code == 200
        assert 'title' in field_names
        assert 'description' in field_names

    @mock.patch('sentry.plugins.IssueTrackingPlugin2.create_issue')
    @mock.patch('sentry.plugins.IssueTrackingPlugin2.is_configured', return_value=True)
    def test_post_create_invalid(self, *args):
        self.login_as(user=self.user)
        url = '/api/0/issues/%s/plugins/issuetrackingplugin2/create/' % self.group.id
        response = self.client.post(url, data={
            'title': '',
            'description': ''
        }, format='json')
        content = json.loads(response.content)
        assert response.status_code == 400
        assert content['error_type'] == 'validation'

    @mock.patch('sentry.plugins.IssueTrackingPlugin2.create_issue', return_value=1)
    @mock.patch('sentry.plugins.IssueTrackingPlugin2.is_configured', return_value=True)
    @mock.patch('sentry.plugins.IssueTrackingPlugin2.get_issue_url', return_value='')
    def test_post_create_valid(self, *args):
        self.login_as(user=self.user)
        url = '/api/0/issues/%s/plugins/issuetrackingplugin2/create/' % self.group.id
        response = self.client.post(url, data={
            'title': 'test',
            'description': 'test'
        }, format='json')
        content = json.loads(response.content)
        assert response.status_code == 200
        assert 'issue_url' in content

    @mock.patch('sentry.plugins.IssueTrackingPlugin2.is_configured', return_value=True)
    def test_get_link(self, *args):
        self.login_as(user=self.user)
        url = '/api/0/issues/%s/plugins/issuetrackingplugin2/link/' % self.group.id
        response = self.client.get(url, format='json')
        assert response.status_code == 200

    @mock.patch('sentry.plugins.IssueTrackingPlugin2.is_configured', return_value=True)
    def test_get_unlink_invalid(self, *args):
        self.login_as(user=self.user)
        url = '/api/0/issues/%s/plugins/issuetrackingplugin2/unlink/' % self.group.id
        response = self.client.get(url, format='json')
        assert response.status_code == 400

    @mock.patch('sentry.plugins.IssueTrackingPlugin2.is_configured', return_value=True)
    def test_get_unlink_valid(self, *args):
        self.login_as(user=self.user)
        id_ = '%s:tid' % self.plugin_instance.get_conf_key()
        GroupMeta.objects.set_value(self.group, id_, 4)
        url = '/api/0/issues/%s/plugins/issuetrackingplugin2/unlink/' % self.group.id
        response = self.client.get(url, format='json')
        assert response.status_code == 200
        GroupMeta.objects.populate_cache([self.group])
        assert GroupMeta.objects.get_value(self.group, id_, None) is None
