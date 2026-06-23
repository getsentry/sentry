from functools import cached_property

from sentry.testutils.cases import PluginTestCase
from sentry_plugins.pivotal.plugin import PivotalPlugin


def test_conf_key() -> None:
    assert PivotalPlugin().conf_key == "pivotal"


class PivotalPluginTest(PluginTestCase):
    @cached_property
    def plugin(self) -> PivotalPlugin:
        return PivotalPlugin()

    def test_get_issue_label(self) -> None:
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_label(group, "1") == "#1"

    def test_get_issue_url(self) -> None:
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert (
            self.plugin.get_issue_url(group, "1") == "https://www.pivotaltracker.com/story/show/1"
        )

    def test_is_configured(self) -> None:
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("token", "1", self.project)
        self.plugin.set_option("project", "1", self.project)
        assert self.plugin.is_configured(self.project) is True
