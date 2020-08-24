# -*- coding: utf-8 -*-

from __future__ import absolute_import


from social_auth.models import UserSocialAuth

from sentry.models import GroupMeta, User
from sentry.plugins.base import plugins
from sentry.plugins.bases import IssueTrackingPlugin2
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils import json
from sentry.utils.compat import mock


class PluginWithFields(IssueTrackingPlugin2):
    slug = "test-plugin-with-fields"
    conf_key = slug
    issue_fields = frozenset(["id", "title", "url"])


class PluginWithoutFields(IssueTrackingPlugin2):
    slug = "test-plugin-without-fields"
    conf_key = slug
    issue_fields = None


class IssueTrackingPlugin2Test(TestCase):
    def test_issue_label_as_dict(self):
        plugin = PluginWithFields()
        result = plugin.get_issue_label(mock.Mock(), {"id": "1"})
        assert result == "#1"

    def test_issue_label_legacy(self):
        plugin = PluginWithoutFields()
        result = plugin.get_issue_label(mock.Mock(), "1")
        assert result == "#1"

    def test_issue_field_map_with_fields(self):
        plugin = PluginWithFields()
        result = plugin.get_issue_field_map()
        assert result == {
            "id": "test-plugin-with-fields:issue_id",
            "title": "test-plugin-with-fields:issue_title",
            "url": "test-plugin-with-fields:issue_url",
        }

    def test_issue_field_map_without_fields(self):
        plugin = PluginWithoutFields()
        result = plugin.get_issue_field_map()
        assert result == {"id": "test-plugin-without-fields:tid"}


class GetAuthForUserTest(TestCase):
    def _get_mock_user(self):
        user = mock.Mock(spec=User(id=1))
        user.is_authenticated.return_value = False
        return user

    def test_requires_auth_provider(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin2()
        self.assertRaises(AssertionError, p.get_auth_for_user, user)

    def test_returns_none_on_missing_identity(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin2()
        p.auth_provider = "test"
        self.assertEquals(p.get_auth_for_user(user), None)

    def test_returns_identity(self):
        user = User.objects.create(username="test", email="test@example.com")
        auth = UserSocialAuth.objects.create(provider="test", user=user)
        p = IssueTrackingPlugin2()
        p.auth_provider = "test"
        self.assertEquals(p.get_auth_for_user(user), auth)


class IssuePlugin2GroupActionTest(TestCase):
    def setUp(self):
        super(IssuePlugin2GroupActionTest, self).setUp()
        self.project = self.create_project()
        self.plugin_instance = plugins.get(slug="issuetrackingplugin2")
        min_ago = iso_format(before_now(minutes=1))
        self.event = self.store_event(
            data={"timestamp": min_ago, "fingerprint": ["group-1"]}, project_id=self.project.id
        )
        self.group = self.event.group

    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.is_configured", return_value=True)
    def test_get_create(self, *args):
        self.login_as(user=self.user)
        url = "/api/0/issues/%s/plugins/issuetrackingplugin2/create/" % self.group.id
        response = self.client.get(url, format="json")
        content = json.loads(response.content)
        field_names = [field["name"] for field in content]
        assert response.status_code == 200
        assert "title" in field_names
        assert "description" in field_names

    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.create_issue")
    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.is_configured", return_value=True)
    def test_post_create_invalid(self, *args):
        self.login_as(user=self.user)
        url = "/api/0/issues/%s/plugins/issuetrackingplugin2/create/" % self.group.id
        response = self.client.post(url, data={"title": "", "description": ""}, format="json")
        content = json.loads(response.content)
        assert response.status_code == 400
        assert content["error_type"] == "validation"

    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.create_issue", return_value=1)
    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.is_configured", return_value=True)
    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.get_issue_url", return_value="")
    def test_post_create_valid(self, *args):
        self.login_as(user=self.user)
        url = "/api/0/issues/%s/plugins/issuetrackingplugin2/create/" % self.group.id
        response = self.client.post(
            url, data={"title": "test", "description": "test"}, format="json"
        )
        content = json.loads(response.content)
        assert response.status_code == 200
        assert "issue_url" in content

    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.is_configured", return_value=True)
    def test_get_link(self, *args):
        self.login_as(user=self.user)
        url = "/api/0/issues/%s/plugins/issuetrackingplugin2/link/" % self.group.id
        response = self.client.get(url, format="json")
        assert response.status_code == 200

    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.is_configured", return_value=True)
    def test_get_unlink_invalid(self, *args):
        self.login_as(user=self.user)
        url = "/api/0/issues/%s/plugins/issuetrackingplugin2/unlink/" % self.group.id
        response = self.client.get(url, format="json")
        assert response.status_code == 400

    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.is_configured", return_value=True)
    def test_get_unlink_valid(self, *args):
        self.login_as(user=self.user)
        id_ = "%s:tid" % self.plugin_instance.get_conf_key()
        GroupMeta.objects.set_value(self.group, id_, 4)
        url = "/api/0/issues/%s/plugins/issuetrackingplugin2/unlink/" % self.group.id
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        GroupMeta.objects.populate_cache([self.group])
        assert GroupMeta.objects.get_value(self.group, id_, None) is None

    @mock.patch("sentry.plugins.bases.IssueTrackingPlugin2.is_configured", return_value=True)
    def test_no_group_events(self, *args):
        self.login_as(user=self.user)
        group = self.create_group(project=self.project)
        url = "/api/0/issues/%s/plugins/issuetrackingplugin2/create/" % group.id
        response = self.client.get(url, format="json")
        assert response.status_code == 400
        assert response.data == {
            "message": "Unable to create issues: there are " "no events associated with this group"
        }
