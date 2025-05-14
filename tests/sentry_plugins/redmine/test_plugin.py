from functools import cached_property

import orjson
import responses
from django.urls import reverse

from sentry.testutils.cases import PluginTestCase
from sentry.testutils.helpers.plugins import assert_app_installed, assert_plugin_installed
from sentry_plugins.redmine.plugin import RedminePlugin


def test_conf_key() -> None:
    assert RedminePlugin().conf_key == "redmine"


def test_entry_point() -> None:
    assert_plugin_installed("redmine", RedminePlugin())
    assert_app_installed("redmine", "sentry_plugins.redmine")


class RedminePluginTest(PluginTestCase):
    @cached_property
    def plugin(self):
        return RedminePlugin()

    @responses.activate
    def test_config_validation(self):
        responses.add(responses.GET, "https://bugs.redmine.org")

        config = {
            "host": "https://bugs.redmine.org",
            "key": "supersecret",
        }

        self.plugin.validate_config(self.project, config)

    def test_no_secrets(self):
        self.login_as(self.user)
        self.plugin.set_option("key", "supersecret", self.project)
        url = reverse(
            "sentry-api-0-project-plugin-details",
            args=[self.organization.slug, self.project.slug, "redmine"],
        )
        res = self.client.get(url)
        config = orjson.loads(res.content)["config"]
        key_config = [item for item in config if item["name"] == "key"][0]
        assert key_config.get("type") == "secret"
        assert key_config.get("value") is None
