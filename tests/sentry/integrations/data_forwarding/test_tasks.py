from unittest.mock import patch

import pytest
import responses
from requests.exceptions import ConnectionError
from taskbroker_client.retry import RetryTaskError

from sentry.integrations.data_forwarding.segment.forwarder import SegmentForwarder
from sentry.integrations.data_forwarding.tasks import forward_event
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase


class ForwardEventTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.segment_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "secret-api-key"},
            is_enabled=True,
        )
        self.segment_forwarder_project = DataForwarderProject.objects.create(
            data_forwarder=self.segment_forwarder,
            project=self.project,
            is_enabled=True,
        )
        self.forwarder = SegmentForwarder()

    @responses.activate
    def test_forwards_event(self) -> None:
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

        config = self.segment_forwarder_project.get_config()
        event_payload = self.forwarder.get_event_payload(event=event, config=config)
        task_payload = self.forwarder.get_task_payload(event=event, config=config)

        forward_event(
            data_forwarder_project_id=self.segment_forwarder_project.id,
            event_payload=event_payload,
            task_payload=task_payload,
        )

        assert len(responses.calls) == 1

    def test_missing_data_forwarder_project(self) -> None:
        forward_event(
            data_forwarder_project_id=999999,
            event_payload={},
            task_payload={},
        )

    @patch(
        "sentry.integrations.data_forwarding.segment.forwarder.SegmentForwarder.forward_event_from_task",
        side_effect=ConnectionError("connection refused"),
    )
    def test_retryable_error_triggers_retry(self, mock_forward) -> None:
        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1"},
                "type": "error",
            },
            project_id=self.project.id,
        )

        config = self.segment_forwarder_project.get_config()
        event_payload = self.forwarder.get_event_payload(event=event, config=config)
        task_payload = self.forwarder.get_task_payload(event=event, config=config)

        with pytest.raises(RetryTaskError):
            forward_event(
                data_forwarder_project_id=self.segment_forwarder_project.id,
                event_payload=event_payload,
                task_payload=task_payload,
            )
