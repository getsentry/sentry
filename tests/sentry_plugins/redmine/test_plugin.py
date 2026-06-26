from functools import cached_property

import responses

from sentry.testutils.cases import PluginTestCase
from sentry_plugins.redmine.plugin import RedminePlugin


def test_conf_key() -> None:
    assert RedminePlugin().conf_key == "redmine"


class RedminePluginTest(PluginTestCase):
    @cached_property
    def plugin(self) -> RedminePlugin:
        return RedminePlugin()

    @responses.activate
    def test_config_validation(self) -> None:
        responses.add(responses.GET, "https://bugs.redmine.org")

        config = {
            "host": "https://bugs.redmine.org",
            "key": "supersecret",
        }

        self.plugin.validate_config(self.project, config)
