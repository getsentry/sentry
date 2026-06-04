from functools import cached_property

from sentry.testutils.cases import PluginTestCase
from sentry_plugins.splunk.plugin import SplunkPlugin


def test_conf_key() -> None:
    assert SplunkPlugin().conf_key == "splunk"


class SplunkPluginTest(PluginTestCase):
    @cached_property
    def plugin(self) -> SplunkPlugin:
        return SplunkPlugin()

    def test_http_payload(self) -> None:
        event = self.store_event(
            data={
                "request": {
                    "url": "http://example.com",
                    "method": "POST",
                    "headers": {"Referer": "http://example.com/foo"},
                }
            },
            project_id=self.project.id,
        )

        result = self.plugin.get_event_payload(event)
        assert result["event"]["request_url"] == "http://example.com/"
        assert result["event"]["request_method"] == "POST"
        assert result["event"]["request_referer"] == "http://example.com/foo"

    def test_error_payload(self) -> None:
        event = self.store_event(
            data={
                "exception": {"values": [{"type": "ValueError", "value": "foo bar"}]},
                "type": "error",
            },
            project_id=self.project.id,
        )

        result = self.plugin.get_event_payload(event)
        assert result["event"]["type"] == "error"
        assert result["event"]["exception_type"] == "ValueError"
        assert result["event"]["exception_value"] == "foo bar"

    def test_csp_payload(self) -> None:
        event = self.store_event(
            data={
                "csp": {
                    "document_uri": "http://example.com/",
                    "violated_directive": "style-src cdn.example.com",
                    "blocked_uri": "http://example.com/style.css",
                    "effective_directive": "style-src",
                },
                "type": "csp",
            },
            project_id=self.project.id,
        )

        result = self.plugin.get_event_payload(event)
        assert result["event"]["type"] == "csp"
        assert result["event"]["csp_document_uri"] == "http://example.com/"
        assert result["event"]["csp_violated_directive"] == "style-src cdn.example.com"
        assert result["event"]["csp_blocked_uri"] == "http://example.com/style.css"
        assert result["event"]["csp_effective_directive"] == "style-src"

    def test_user_payload(self) -> None:
        event = self.store_event(
            data={"user": {"id": "1", "email": "foo@example.com", "ip_address": "127.0.0.1"}},
            project_id=self.project.id,
        )

        result = self.plugin.get_event_payload(event)
        assert result["event"]["user_id"] == "1"
        assert result["event"]["user_email_hash"] == "b48def645758b95537d4424c84d1a9ff"
        assert result["event"]["user_ip_trunc"] == "127.0.0.0"
