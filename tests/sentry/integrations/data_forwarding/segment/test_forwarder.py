import orjson
import pytest
import responses
from requests.exceptions import HTTPError

from sentry import VERSION
from sentry.integrations.data_forwarding.segment.forwarder import SegmentForwarder
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class SegmentDataForwarderTest(TestCase):
    def setUp(self) -> None:
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
    def test_simple_notification(self) -> None:
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
    def test_forward_event_http_error(self) -> None:
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

    def test_get_task_payload(self) -> None:
        config = self.data_forwarder_project.get_config()
        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1"},
                "type": "error",
            },
            project_id=self.project.id,
        )
        assert self.forwarder.get_task_payload(event, config) == {
            "event_type": "error",
            "has_user": True,
        }

        event = self.store_event(
            data={
                "user": {"email": "foo@example.com"},
                "type": "feedback",
            },
            project_id=self.project.id,
        )
        assert self.forwarder.get_task_payload(event, config) == {
            "event_type": "feedback",
            "has_user": False,
        }

    @responses.activate
    @override_options({"data-forwarding.task-rollout-rate": 1.0})
    def test_forward_event_from_task(self) -> None:
        responses.add(responses.POST, "https://api.segment.io/v1/track")

        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1", "email": "foo@example.com"},
                "type": "error",
                "level": "warning",
            },
            project_id=self.project.id,
        )

        with self.tasks():
            self.forwarder.post_process(event, self.data_forwarder_project)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        assert payload["userId"] == "1"
        assert payload["event"] == "Error Captured"

    @responses.activate
    def test_forward_event_from_task_raises_on_http_error(self) -> None:
        responses.add(responses.POST, "https://api.segment.io/v1/track", status=500)

        config = self.data_forwarder_project.get_config()

        with pytest.raises(HTTPError):
            SegmentForwarder.forward_event_from_task(
                config=config,
                event_payload={"test": True},
                task_payload={"event_type": "error", "has_user": True},
            )
