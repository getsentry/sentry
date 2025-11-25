import orjson
import responses

from sentry.integrations.data_forwarding.splunk.forwarder import SplunkForwarder
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase


class SplunkDataForwarderTest(TestCase):
    def setUp(self):
        super().setUp()
        self.data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SPLUNK,
            config={
                "instance_url": "https://splunk.example.com:8088",
                "token": "12345678-1234-1234-1234-1234567890AB",
                "index": "main",
                "source": "sentry",
            },
            is_enabled=True,
        )
        self.data_forwarder_project = DataForwarderProject.objects.create(
            data_forwarder=self.data_forwarder,
            project=self.project,
            is_enabled=True,
        )
        self.forwarder = SplunkForwarder()

    @responses.activate
    def test_simple_notification(self):
        responses.add(responses.POST, "https://splunk.example.com:8088/services/collector")

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )

        self.forwarder.post_process(event, self.data_forwarder_project)
        assert len(responses.calls) == 1

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        assert payload["index"] == "main"
        assert payload["source"] == "sentry"
        assert "event" in payload
        assert payload["event"]["event_id"] == event.event_id
        assert payload["event"]["project_id"] == event.project.slug
        assert request.headers["Authorization"] == "Splunk 12345678-1234-1234-1234-1234567890AB"

    @responses.activate
    def test_dont_reraise_error(self):
        responses.add(
            responses.POST, "https://splunk.example.com:8088/services/collector", status=404
        )

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )

        self.forwarder.post_process(event, self.data_forwarder_project)

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

        config = self.data_forwarder_project.get_config()
        result = self.forwarder.get_event_payload(event, config)
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

        config = self.data_forwarder_project.get_config()
        result = self.forwarder.get_event_payload(event, config)
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

        config = self.data_forwarder_project.get_config()
        result = self.forwarder.get_event_payload(event, config)
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

        config = self.data_forwarder_project.get_config()
        result = self.forwarder.get_event_payload(event, config)
        assert result["event"]["user_id"] == "1"
        assert result["event"]["user_email_hash"] == "b48def645758b95537d4424c84d1a9ff"
        assert result["event"]["user_ip_trunc"] == "127.0.0.0"
        assert result["index"] == "main"
        assert result["source"] == "sentry"
