import responses

from sentry.integrations.data_forwarding.segment.forwarder import SegmentForwarder
from sentry.integrations.data_forwarding.tasks import forward_event
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class ForwardEventTaskTest(TestCase):
    def setUp(self) -> None:
        self.data_forwarder = self.create_data_forwarder(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "secret-api-key"},
            is_enabled=True,
        )
        self.data_forwarder_project = self.create_data_forwarder_project(
            data_forwarder=self.data_forwarder,
            project=self.project,
            is_enabled=True,
        )
        self.forwarder = SegmentForwarder()
        self.event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1", "email": "foo@example.com"},
                "type": "error",
                "metadata": {"type": "ValueError", "value": "foo bar"},
                "level": "warning",
            },
            project_id=self.project.id,
        )

    @responses.activate
    def test_forwards_event(self) -> None:
        responses.add(responses.POST, "https://api.segment.io/v1/track")
        config = self.data_forwarder_project.get_config()
        event_payload = self.forwarder.get_event_payload(event=self.event, config=config)
        task_payload = self.forwarder.get_task_payload(event=self.event, config=config)
        forward_event(
            data_forwarder_project_id=self.data_forwarder_project.id,
            event_payload=event_payload,
            task_payload=task_payload,
        )
        assert len(responses.calls) == 1

    @responses.activate
    @override_options({"data-forwarding.task-rollout-rate": 1.0})
    def test_post_process_dispatches_to_task(self) -> None:
        responses.add(responses.POST, "https://api.segment.io/v1/track")
        with self.tasks():
            self.forwarder.post_process(self.event, self.data_forwarder_project)
        assert len(responses.calls) == 1

    def test_missing_data_forwarder_project(self) -> None:
        result = forward_event(data_forwarder_project_id=-1, event_payload={}, task_payload={})
        assert result is None
