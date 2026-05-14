from unittest.mock import patch

import responses

from sentry.integrations.data_forwarding.segment.forwarder import SegmentForwarder
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class BaseDataForwarderTest(TestCase):
    def setUp(self) -> None:
        self.forwarder = self.create_data_forwarder(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "secret-api-key"},
            is_enabled=True,
        )
        self.forwarder_project = self.create_data_forwarder_project(
            data_forwarder=self.forwarder,
            project=self.project,
            is_enabled=True,
        )
        self.forwarder_cls = SegmentForwarder()
        self.event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1"},
                "type": "error",
            },
            project_id=self.project.id,
        )

    @responses.activate
    @override_options({"data-forwarding.task-rollout-rate": 1.0})
    @patch("sentry.integrations.data_forwarding.tasks.forward_event")
    @patch("sentry.integrations.data_forwarding.base.random.random", return_value=0.5)
    def test_post_process_rollout_dispatches_to_task(self, mock_random, mock_forward_event) -> None:
        responses.add(responses.POST, "https://api.segment.io/v1/track")
        self.forwarder_cls.post_process(self.event, self.forwarder_project)
        mock_forward_event.delay.assert_called_once()

    @responses.activate
    def test_post_process_rollout_forwards_directly(self) -> None:
        responses.add(responses.POST, "https://api.segment.io/v1/track")
        self.forwarder_cls.post_process(self.event, self.forwarder_project)
        assert len(responses.calls) == 1
