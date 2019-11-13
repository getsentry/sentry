from __future__ import absolute_import

from exam import fixture
from django.test import RequestFactory
from sentry.testutils import PluginTestCase

from new_sentry_plugins.jira_ac.plugin import JiraACPlugin


class JiraPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return JiraACPlugin()

    @fixture
    def request(self):
        return RequestFactory()

    def test_conf_key(self):
        assert self.plugin.conf_key == "jira-ac"

    def test_entry_point(self):
        self.assertNewAppInstalled("jira_ac", "new_sentry_plugins.jira_ac")
        self.assertNewPluginInstalled("jira_ac", self.plugin)
