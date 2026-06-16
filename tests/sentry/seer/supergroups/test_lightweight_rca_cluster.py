from unittest.mock import patch

import pytest

from sentry.seer.supergroups.lightweight_rca_cluster import trigger_lightweight_rca_cluster
from sentry.testutils.cases import TestCase

EVENT_DATA_WITH_STACKTRACE = {
    "message": "test error",
    "level": "error",
    "platform": "python",
    "exception": {
        "values": [
            {
                "type": "ValueError",
                "value": "test",
                "stacktrace": {
                    "frames": [
                        {
                            "function": "test_func",
                            "filename": "test.py",
                            "lineno": 1,
                        }
                    ]
                },
            }
        ]
    },
}


class TriggerLightweightRCAClusterTest(TestCase):
    def setUp(self):
        super().setUp()
        self.event = self.store_event(
            data=EVENT_DATA_WITH_STACKTRACE,
            project_id=self.project.id,
        )
        self.group = self.event.group

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_calls_seer_with_correct_payload(self, mock_request):
        mock_request.return_value.status = 200

        trigger_lightweight_rca_cluster(self.group)

        mock_request.assert_called_once()
        body = mock_request.call_args.args[0]
        assert body["group_id"] == self.group.id
        assert body["organization_id"] == self.group.organization.id
        assert body["organization_slug"] == self.group.organization.slug
        assert body["project_id"] == self.group.project.id
        assert body["issue"]["id"] == self.group.id
        assert body["issue"]["title"] == self.group.title
        assert "events" in body["issue"]
        assert len(body["issue"]["events"]) == 1

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_raises_on_seer_error(self, mock_request):
        mock_request.return_value.status = 500

        with pytest.raises(Exception):
            trigger_lightweight_rca_cluster(self.group)

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_skips_event_without_stacktrace(self, mock_request):
        event = self.store_event(
            data={"message": "no stacktrace here", "level": "error", "fingerprint": ["no-stack"]},
            project_id=self.project.id,
        )
        assert event.group is not None

        trigger_lightweight_rca_cluster(event.group)

        mock_request.assert_not_called()

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_skips_event_with_unsupported_platform(self, mock_request):
        event = self.store_event(
            data={**EVENT_DATA_WITH_STACKTRACE, "platform": "other", "fingerprint": ["other-plat"]},
            project_id=self.project.id,
        )
        assert event.group is not None

        trigger_lightweight_rca_cluster(event.group)

        mock_request.assert_not_called()
