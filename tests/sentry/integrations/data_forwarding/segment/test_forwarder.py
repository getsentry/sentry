import orjson
import responses

from sentry import VERSION
from sentry.integrations.data_forwarding.segment.forwarder import SegmentForwarder
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase


class SegmentDataForwarderTest(TestCase):
    def setUp(self):
        super().setUp()
        self.data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "secret-api-key"},
            is_enabled=True,
        )
        self.data_forwarder_project = DataForwarderProject.objects.create(
            data_forwarder=self.data_forwarder,
            project=self.project,
            is_enabled=True,
        )
        self.forwarder = SegmentForwarder()

    @responses.activate
    def test_simple_notification(self):
        responses.add(responses.POST, "https://api.segment.io/v1/track")

        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1", "email": "foo@example.com"},
                "type": "error",
                "metadata": {"type": "ValueError", "value": "foo bar"},
                "level": "warning",
            },
            project_id=self.project.id,
        )

        self.forwarder.post_process(event, self.data_forwarder_project)

        assert len(responses.calls) == 1

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        assert {
            "userId": "1",
            "event": "Error Captured",
            "context": {"library": {"name": "sentry", "version": VERSION}},
            "properties": {
                "environment": "",
                "eventId": event.event_id,
                "exceptionType": "ValueError",
                "level": "warning",
                "release": "",
                "transaction": "",
            },
            "integration": {"name": "sentry", "version": VERSION},
            "timestamp": event.datetime.isoformat() + "Z",
        } == payload

    @responses.activate
    def test_forward_event_http_error(self):
        responses.add(responses.POST, "https://api.segment.io/v1/track", status=500)

        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1"},
                "type": "error",
            },
            project_id=self.project.id,
        )

        self.forwarder.post_process(event, self.data_forwarder_project)
