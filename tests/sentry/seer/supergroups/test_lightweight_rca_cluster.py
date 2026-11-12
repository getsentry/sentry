from unittest.mock import MagicMock, patch

import pytest
from urllib3 import HTTPConnectionPool
from urllib3.exceptions import MaxRetryError, ReadTimeoutError

from sentry.seer.models import SeerApiError
from sentry.seer.supergroups.lightweight_rca_cluster import trigger_lightweight_rca_cluster
from sentry.tasks.seer.lightweight_rca_cluster import trigger_lightweight_rca_cluster_task
from sentry.testutils.cases import TestCase

SEER_PATH = "/v0/issues/supergroups/cluster-lightweight"

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
    def setUp(self) -> None:
        super().setUp()
        self.event = self.store_event(
            data=EVENT_DATA_WITH_STACKTRACE,
            project_id=self.project.id,
        )
        group = self.event.group
        assert group is not None
        self.group = group

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_calls_seer_with_correct_payload(self, mock_request: MagicMock) -> None:
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
    def test_raises_on_seer_error(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 500

        with pytest.raises(Exception):
            trigger_lightweight_rca_cluster(self.group)

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.metrics.incr")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_counts_seer_http_error(self, mock_request: MagicMock, mock_incr: MagicMock) -> None:
        mock_request.return_value.status = 500

        with pytest.raises(SeerApiError):
            trigger_lightweight_rca_cluster(self.group)

        mock_incr.assert_any_call(
            "seer.lightweight_rca_cluster.request",
            tags={"outcome": "error", "error": "http_5xx"},
        )

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.metrics.incr")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_counts_success(self, mock_request: MagicMock, mock_incr: MagicMock) -> None:
        mock_request.return_value.status = 200

        trigger_lightweight_rca_cluster(self.group)

        mock_incr.assert_any_call(
            "seer.lightweight_rca_cluster.request", tags={"outcome": "success"}
        )

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.metrics.incr")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.logger")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_read_timeout_is_logged_and_counted(
        self, mock_request: MagicMock, mock_logger: MagicMock, mock_incr: MagicMock
    ) -> None:
        mock_request.side_effect = ReadTimeoutError(
            HTTPConnectionPool("localhost"), SEER_PATH, "timed out"
        )

        trigger_lightweight_rca_cluster(self.group)

        mock_request.assert_called_once()
        mock_logger.warning.assert_called_once_with(
            "lightweight_rca_cluster.request_error",
            extra={
                "group_id": self.group.id,
                "project_id": self.group.project.id,
                "organization_id": self.group.organization.id,
                "event_id": self.event.event_id,
                "error": "ReadTimeoutError",
            },
        )
        mock_logger.info.assert_not_called()
        mock_incr.assert_any_call(
            "seer.lightweight_rca_cluster.request",
            tags={"outcome": "error", "error": "ReadTimeoutError"},
        )

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.metrics.incr")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.logger")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_max_retry_error_is_logged_and_counted(
        self, mock_request: MagicMock, mock_logger: MagicMock, mock_incr: MagicMock
    ) -> None:
        mock_request.side_effect = MaxRetryError(HTTPConnectionPool("localhost"), SEER_PATH)

        trigger_lightweight_rca_cluster(self.group)

        mock_request.assert_called_once()
        mock_logger.warning.assert_called_once_with(
            "lightweight_rca_cluster.request_error",
            extra={
                "group_id": self.group.id,
                "project_id": self.group.project.id,
                "organization_id": self.group.organization.id,
                "event_id": self.event.event_id,
                "error": "MaxRetryError",
            },
        )
        mock_logger.info.assert_not_called()
        mock_incr.assert_any_call(
            "seer.lightweight_rca_cluster.request",
            tags={"outcome": "error", "error": "MaxRetryError"},
        )

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.logger")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_unexpected_request_error_propagates(
        self, mock_request: MagicMock, mock_logger: MagicMock
    ) -> None:
        mock_request.side_effect = ValueError("unexpected")

        with pytest.raises(ValueError):
            trigger_lightweight_rca_cluster(self.group)

        mock_logger.warning.assert_not_called()

    @patch("sentry.tasks.seer.lightweight_rca_cluster.logger")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_task_does_not_report_request_timeout(
        self, mock_request: MagicMock, mock_task_logger: MagicMock
    ) -> None:
        mock_request.side_effect = ReadTimeoutError(
            HTTPConnectionPool("localhost"), SEER_PATH, "timed out"
        )

        trigger_lightweight_rca_cluster_task(self.group.id, event_id=self.event.event_id)

        mock_request.assert_called_once()
        mock_task_logger.exception.assert_not_called()

    @patch("sentry.tasks.seer.lightweight_rca_cluster.logger")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_task_reports_unexpected_request_error(
        self, mock_request: MagicMock, mock_task_logger: MagicMock
    ) -> None:
        mock_request.side_effect = ValueError("unexpected")

        with pytest.raises(ValueError):
            trigger_lightweight_rca_cluster_task(self.group.id, event_id=self.event.event_id)

        mock_task_logger.exception.assert_called_once()

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_skips_event_without_stacktrace(self, mock_request: MagicMock) -> None:
        event = self.store_event(
            data={"message": "no stacktrace here", "level": "error", "fingerprint": ["no-stack"]},
            project_id=self.project.id,
        )
        assert event.group is not None

        trigger_lightweight_rca_cluster(event.group)

        mock_request.assert_not_called()

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_skips_event_with_unsupported_platform(self, mock_request: MagicMock) -> None:
        event = self.store_event(
            data={**EVENT_DATA_WITH_STACKTRACE, "platform": "other", "fingerprint": ["other-plat"]},
            project_id=self.project.id,
        )
        assert event.group is not None

        trigger_lightweight_rca_cluster(event.group)

        mock_request.assert_not_called()
