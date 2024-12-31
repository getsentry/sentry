from functools import cached_property

import responses
from pytest import raises

from sentry.exceptions import PluginError
from sentry.testutils.cases import PluginTestCase
from sentry.testutils.helpers import override_blocklist
from sentry_plugins.phabricator.plugin import PhabricatorPlugin


class PhabricatorPluginTest(PluginTestCase):
    @cached_property
    def plugin(self):
        return PhabricatorPlugin()

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
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("host", "http://secure.phabricator.org", self.project)
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)
        assert self.plugin.is_configured(self.project) is True
        self.plugin.unset_option("token", self.project)
        self.plugin.set_option("username", "a-user", self.project)
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("certificate", "a-certificate", self.project)
        assert self.plugin.is_configured(self.project) is True

    @override_blocklist("127.0.0.1")
    def test_invalid_url(self):
        with raises(PluginError):
            self.plugin.validate_config_field(
                project=self.project, name="host", value="ftp://example.com"
            )
        with raises(PluginError):
            self.plugin.validate_config_field(
                project=self.project, name="host", value="http://127.0.0.1"
            )
