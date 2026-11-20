from datetime import timedelta
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from urllib3 import HTTPConnectionPool
from urllib3.exceptions import MaxRetryError, ReadTimeoutError

from sentry.api.serializers import EventSerializer, serialize
from sentry.eventstore import backend as eventstore
from sentry.seer.models import SeerApiError
from sentry.seer.supergroups.lightweight_rca_cluster import trigger_lightweight_rca_cluster
from sentry.tasks.seer.lightweight_rca_cluster import trigger_lightweight_rca_cluster_task
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import _snuba_pool

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

# No exception interface, so the event type is "default". The top level stack trace
# keeps it eligible for Seer.
DEFAULT_EVENT_DATA_WITH_STACKTRACE = {
    "message": "test message",
    "level": "error",
    "platform": "python",
    "fingerprint": ["default-with-stack"],
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

GET_EVENT_BY_ID = "sentry.seer.supergroups.lightweight_rca_cluster.eventstore.get_event_by_id"


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

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_without_event_id_uses_latest_event(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        older_event = self.store_event(
            data={
                **EVENT_DATA_WITH_STACKTRACE,
                "timestamp": before_now(minutes=5).isoformat(),
            },
            project_id=self.project.id,
        )
        assert older_event.group_id == self.group.id

        with patch(GET_EVENT_BY_ID, wraps=eventstore.get_event_by_id) as mock_get_event_by_id:
            trigger_lightweight_rca_cluster(self.group)

        mock_get_event_by_id.assert_called_once_with(
            self.project.id, self.event.event_id, group_id=self.group.id
        )
        mock_request.assert_called_once()
        events = mock_request.call_args.args[0]["issue"]["events"]
        assert [sent["eventID"] for sent in events] == [self.event.event_id]

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_event_id_reads_error_event_from_nodestore(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        assert self.event.get_event_type() == "error"

        with patch(GET_EVENT_BY_ID) as mock_get_event_by_id:
            trigger_lightweight_rca_cluster(self.group, event_id=self.event.event_id)

        mock_get_event_by_id.assert_not_called()
        mock_request.assert_called_once()
        events = mock_request.call_args.args[0]["issue"]["events"]
        assert [sent["eventID"] for sent in events] == [self.event.event_id]

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_event_id_reads_default_event_without_snuba(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        event = self.store_event(
            data={**DEFAULT_EVENT_DATA_WITH_STACKTRACE},
            project_id=self.project.id,
        )
        assert event.get_event_type() == "default"
        assert event.group is not None

        # Every Snuba query goes through this connection pool.
        with patch.object(_snuba_pool, "urlopen") as mock_urlopen:
            trigger_lightweight_rca_cluster(event.group, event_id=event.event_id)

        assert mock_urlopen.call_count == 0
        mock_request.assert_called_once()
        events = mock_request.call_args.args[0]["issue"]["events"]
        assert [sent["eventID"] for sent in events] == [event.event_id]

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.sentry_sdk")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_event_id_sets_event_type_on_trace(
        self, mock_request: MagicMock, mock_sdk: MagicMock
    ) -> None:
        mock_request.return_value.status = 200
        event = self.store_event(
            data={**DEFAULT_EVENT_DATA_WITH_STACKTRACE},
            project_id=self.project.id,
        )
        assert event.group is not None

        trigger_lightweight_rca_cluster(event.group, event_id=event.event_id)

        # The same tag and attribute get_event_by_id sets when it is given a group id.
        mock_sdk.set_tag.assert_called_once_with("nodestore.event_type", "default")
        mock_sdk.set_attribute.assert_called_once_with("nodestore.event_type", "default")

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.logger")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_event_id_missing_from_nodestore(
        self, mock_request: MagicMock, mock_logger: MagicMock
    ) -> None:
        missing_event_id = "f" * 32

        trigger_lightweight_rca_cluster(self.group, event_id=missing_event_id)

        mock_logger.info.assert_called_once_with(
            "lightweight_rca_cluster.event_not_ready",
            extra={"group_id": self.group.id, "event_id": missing_event_id},
        )
        mock_request.assert_not_called()

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.logger")
    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_invalid_event_id(self, mock_request: MagicMock, mock_logger: MagicMock) -> None:
        trigger_lightweight_rca_cluster(self.group, event_id="not-an-event-id")

        mock_logger.info.assert_called_once_with(
            "lightweight_rca_cluster.event_not_ready",
            extra={"group_id": self.group.id, "event_id": "not-an-event-id"},
        )
        mock_request.assert_not_called()

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_event_id_is_normalized(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        dashed_uppercase_event_id = str(UUID(self.event.event_id)).upper()
        assert dashed_uppercase_event_id != self.event.event_id

        trigger_lightweight_rca_cluster(self.group, event_id=dashed_uppercase_event_id)

        mock_request.assert_called_once()
        events = mock_request.call_args.args[0]["issue"]["events"]
        assert [sent["eventID"] for sent in events] == [self.event.event_id]

    @patch("sentry.seer.supergroups.lightweight_rca_cluster.make_lightweight_rca_cluster_request")
    def test_event_id_payload_matches_snuba_backed_event(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 200
        # Microseconds that do not fit in milliseconds, so a precision difference shows.
        timestamp = before_now(seconds=30).replace(microsecond=123456)
        event = self.store_event(
            data={**DEFAULT_EVENT_DATA_WITH_STACKTRACE, "timestamp": timestamp.isoformat()},
            project_id=self.project.id,
        )
        assert event.get_event_type() == "default"
        group = event.group
        assert group is not None

        trigger_lightweight_rca_cluster(group, event_id=event.event_id)

        mock_request.assert_called_once()
        (sent,) = mock_request.call_args.args[0]["issue"]["events"]
        assert sent["eventID"] == event.event_id
        assert sent["groupID"] == str(group.id)
        assert sent["projectID"] == str(self.project.id)
        assert sent["type"] == "default"
        assert sent["platform"] == "python"
        assert sent["title"] == group.title
        assert [entry["type"] for entry in sent["entries"]] == ["message", "stacktrace"]

        # The event get_event_by_id returns for a default type event carries Snuba columns.
        snuba_backed_event = eventstore.get_event_by_id(
            self.project.id, event.event_id, group_id=group.id
        )
        assert snuba_backed_event is not None
        assert snuba_backed_event._snuba_data
        expected = serialize(snuba_backed_event, None, EventSerializer())

        # dateCreated is the only field that differs. The Snuba column has millisecond
        # precision and nodestore keeps the microseconds.
        assert sent.keys() == expected.keys()
        assert {key for key in expected if sent[key] != expected[key]} == {"dateCreated"}
        assert sent["dateCreated"] == timestamp
        assert abs(sent["dateCreated"] - expected["dateCreated"]) < timedelta(milliseconds=1)
