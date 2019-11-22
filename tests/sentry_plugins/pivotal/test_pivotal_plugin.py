from __future__ import absolute_import

from exam import fixture
from django.core.urlresolvers import reverse
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.pivotal.plugin import PivotalPlugin


class PivotalPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return PivotalPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "pivotal"

    def test_entry_point(self):
        self.assertPluginInstalled("pivotal", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_label(group, 1) == "#1"

    def test_get_issue_url(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_url(group, 1) == "https://www.pivotaltracker.com/story/show/1"

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("token", "1", self.project)
        self.plugin.set_option("project", "1", self.project)
        assert self.plugin.is_configured(None, self.project) is True

    def test_no_secrets(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.plugin.set_option("token", "abcdef", self.project)
        url = reverse(
            "sentry-api-0-project-plugin-details",
            args=[self.org.slug, self.project.slug, "pivotal"],
        )
        res = self.client.get(url)
        config = json.loads(res.content)["config"]
        token_config = [item for item in config if item["name"] == "token"][0]
        assert token_config.get("type") == "secret"
        assert token_config.get("value") is None
        assert token_config.get("hasSavedValue") is True
        assert token_config.get("prefix") == "abcd"
