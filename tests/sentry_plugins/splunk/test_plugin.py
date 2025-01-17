from functools import cached_property

import orjson
import pytest
import responses

from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import PluginTestCase
from sentry_plugins.splunk.plugin import SplunkPlugin


class SplunkPluginTest(PluginTestCase):
    @cached_property
    def plugin(self):
        return SplunkPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "splunk"

    def test_entry_point(self):
        self.assertPluginInstalled("splunk", self.plugin)

    @responses.activate
    def test_simple_notification(self):
        responses.add(responses.POST, "https://splunk.example.com:8088/services/collector")

        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)
        self.plugin.set_option("index", "main", self.project)
        self.plugin.set_option("instance", "https://splunk.example.com:8088", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.post_process(event=event)

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        assert payload == self.plugin.get_event_payload(event)
        headers = request.headers
        assert headers["Authorization"] == "Splunk 12345678-1234-1234-1234-1234567890AB"

    @responses.activate
    def test_dont_reraise_error(self):
        responses.add(
            responses.POST, "https://splunk.example.com:8088/services/collector", status=404
        )

        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)
        self.plugin.set_option("index", "main", self.project)
        self.plugin.set_option("instance", "https://splunk.example.com:8088", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.post_process(event=event)

        resp = responses.calls[0].response
        assert resp.status_code == 404

    @responses.activate
    def test_reraise_error(self):
        responses.add(
            responses.POST, "https://splunk.example.com:8088/services/collector", status=500
        )

        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)
        self.plugin.set_option("index", "main", self.project)
        self.plugin.set_option("instance", "https://splunk.example.com:8088", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        with self.options({"system.url-prefix": "http://example.com"}):
            with pytest.raises(ApiError):
                self.plugin.post_process(event=event)

    def test_http_payload(self):
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

    def test_error_payload(self):
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

    def test_csp_payload(self):
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

    def test_user_payload(self):
        event = self.store_event(
            data={"user": {"id": "1", "email": "foo@example.com", "ip_address": "127.0.0.1"}},
            project_id=self.project.id,
        )

        result = self.plugin.get_event_payload(event)
        assert result["event"]["user_id"] == "1"
        assert result["event"]["user_email_hash"] == "b48def645758b95537d4424c84d1a9ff"
        assert result["event"]["user_ip_trunc"] == "127.0.0.0"
