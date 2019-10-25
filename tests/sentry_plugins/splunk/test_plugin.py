from __future__ import absolute_import

import responses

from exam import fixture
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.splunk.plugin import SplunkPlugin


class SplunkPluginTest(PluginTestCase):
    @fixture
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

        group = self.create_group(message="Hello world", culprit="foo.bar")
        event = self.create_event(
            group=group,
            data={
                "sentry.interfaces.Exception": {"type": "ValueError", "value": "foo bar"},
                "sentry.interfaces.User": {"id": "1", "email": "foo@example.com"},
                "type": "error",
            },
            tags={"level": "warning"},
        )

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.post_process(event)

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert payload == {
            "index": "main",
            "source": "sentry",
            "time": int(event.datetime.strftime("%s")),
            "event": self.plugin.get_event_payload(event),
        }
        headers = request.headers
        assert headers["Authorization"] == "Splunk 12345678-1234-1234-1234-1234567890AB"

    def test_http_payload(self):
        event = self.create_event(
            group=self.group,
            data={
                "sentry.interfaces.Http": {
                    "url": "http://example.com",
                    "method": "POST",
                    "headers": {"Referer": "http://example.com/foo"},
                }
            },
        )

        result = self.plugin.get_event_payload(event)
        assert result["request_url"] == "http://example.com/"
        assert result["request_method"] == "POST"
        assert result["request_referer"] == "http://example.com/foo"

    def test_error_payload(self):
        event = self.create_event(
            group=self.group,
            data={
                "sentry.interfaces.Exception": {
                    "values": [{"type": "ValueError", "value": "foo bar"}]
                },
                "type": "error",
            },
        )

        result = self.plugin.get_event_payload(event)
        assert result["type"] == "error"
        assert result["exception_type"] == "ValueError"
        assert result["exception_value"] == "foo bar"

    def test_csp_payload(self):
        event = self.create_event(
            group=self.group,
            data={
                "csp": {
                    "document_uri": "http://example.com/",
                    "violated_directive": "style-src cdn.example.com",
                    "blocked_uri": "http://example.com/style.css",
                    "effective_directive": "style-src",
                },
                "type": "csp",
            },
        )

        result = self.plugin.get_event_payload(event)
        assert result["type"] == "csp"
        assert result["csp_document_uri"] == "http://example.com/"
        assert result["csp_violated_directive"] == "style-src cdn.example.com"
        assert result["csp_blocked_uri"] == "http://example.com/style.css"
        assert result["csp_effective_directive"] == "style-src"

    def test_user_payload(self):
        event = self.create_event(
            group=self.group,
            data={
                "sentry.interfaces.User": {
                    "id": "1",
                    "email": "foo@example.com",
                    "ip_address": "127.0.0.1",
                }
            },
        )

        result = self.plugin.get_event_payload(event)
        assert result["user_id"] == "1"
        assert result["user_email_hash"] == "b48def645758b95537d4424c84d1a9ff"
        assert result["user_ip_trunc"] == "127.0.0.0"
