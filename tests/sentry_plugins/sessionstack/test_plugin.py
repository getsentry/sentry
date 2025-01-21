from functools import cached_property

import orjson
import responses
from django.urls import reverse

from sentry.testutils.cases import PluginTestCase
from sentry_plugins.sessionstack.plugin import SessionStackPlugin

EXPECTED_SESSION_URL = (
    "https://app.sessionstack.com/player/#/sessions/588778a6c5762c1d566653ff"
    "?source=sentry&access_token=example-access-token"
)

ACCESS_TOKENS_URL = (
    "https://api.sessionstack.com/v1/websites/0/sessions/" "588778a6c5762c1d566653ff/access_tokens"
)


class SessionStackPluginTest(PluginTestCase):
    @cached_property
    def plugin(self):
        return SessionStackPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "sessionstack"

    def test_entry_point(self):
        self.assertPluginInstalled("sessionstack", self.plugin)
        self.assertAppInstalled("sessionstack", "sentry_plugins.sessionstack")

    @responses.activate
    def test_config_validation(self):
        responses.add(responses.GET, "https://api.sessionstack.com/v1/websites/0")

        config = {
            "account_email": "user@example.com",
            "api_token": "example-api-token",
            "website_id": 0,
        }

        self.plugin.validate_config(self.project, config)

    @responses.activate
    def test_event_preprocessing(self):
        responses.add(
            responses.GET,
            ACCESS_TOKENS_URL,
            json={"data": [{"name": "Sentry", "access_token": "example-access-token"}]},
        )
        responses.add(
            responses.POST,
            ACCESS_TOKENS_URL,
            json={"data": [{"name": "Sentry", "access_token": "example-access-token"}]},
        )

        self.plugin.enable(self.project)
        self.plugin.set_option("account_email", "user@example.com", self.project)
        self.plugin.set_option("api_token", "example-api-token", self.project)
        self.plugin.set_option("website_id", 0, self.project)

        event = {
            "project": self.project.id,
            "contexts": {
                "sessionstack": {"session_id": "588778a6c5762c1d566653ff", "type": "sessionstack"}
            },
            "platform": "javascript",
        }

        event_preprocessors = self.plugin.get_event_preprocessors(event)
        add_sessionstack_context = event_preprocessors[0]

        processed_event = add_sessionstack_context(event)

        event_contexts = processed_event.get("contexts")
        sessionstack_context = event_contexts.get("sessionstack")
        session_url = sessionstack_context.get("session_url")

        assert session_url == EXPECTED_SESSION_URL

    def test_no_secrets(self):
        self.login_as(self.user)
        self.plugin.set_option("api_token", "example-api-token", self.project)
        url = reverse(
            "sentry-api-0-project-plugin-details",
            args=[self.organization.slug, self.project.slug, "sessionstack"],
        )
        res = self.client.get(url)
        config = orjson.loads(res.content)["config"]
        api_token_config = [item for item in config if item["name"] == "api_token"][0]
        assert api_token_config.get("type") == "secret"
        assert api_token_config.get("value") is None
