from __future__ import absolute_import

import responses

from exam import fixture
from django.test import RequestFactory
from sentry.testutils import PluginTestCase

from sentry_plugins.phabricator.plugin import PhabricatorPlugin


class PhabricatorPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return PhabricatorPlugin()

    @fixture
    def request(self):
        return RequestFactory()

    def test_conf_key(self):
        assert self.plugin.conf_key == "phabricator"

    def test_entry_point(self):
        self.assertPluginInstalled("phabricator", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_label(group, 1) == "T1"

    @responses.activate
    def test_get_issue_url(self):
        self.plugin.set_option("host", "http://secure.phabricator.org", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_url(group, "1") == "http://secure.phabricator.org/T1"

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("host", "http://secure.phabricator.org", self.project)
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)
        assert self.plugin.is_configured(None, self.project) is True
        self.plugin.unset_option("token", self.project)
        self.plugin.set_option("username", "a-user", self.project)
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("certificate", "a-certificate", self.project)
        assert self.plugin.is_configured(None, self.project) is True
