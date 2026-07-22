from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
from sentry.seer.smart_assignment.delivery import deliver_smart_assignment_result
from sentry.seer.smart_assignment.models import SEER_FEATURE_ID
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

METRICS_PATH = "sentry.seer.smart_assignment.delivery.metrics"


class DeliverSmartAssignmentResultTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.seer_run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.FEATURE_RUN,
            last_triggered_at=timezone.now(),
        )
        # The run mirror the client would have created at dispatch.
        self.mirror = SeerAgentRun.objects.create(
            run=self.seer_run,
            source=SEER_FEATURE_ID,
            group=self.group,
            extras={"trigger": ActivityType.SEER_RCA_STARTED.name},
        )

    def _extras(self) -> dict[str, Any]:
        self.mirror.refresh_from_db()
        return self.mirror.extras

    def _deliver(
        self,
        result: dict[str, Any] | None,
        status: FeatureRunStatus = "completed",
        error: str | None = None,
    ) -> None:
        deliver_smart_assignment_result(
            self.organization.id, self.seer_run.uuid, status, result, error
        )

    def _assert_outcome(self, mock_metrics: MagicMock, expected: str) -> None:
        mock_metrics.incr.assert_called_once_with(
            "smart_assignment.delivery", tags={"outcome": expected}, sample_rate=1.0
        )

    def _completion_activity(self) -> Activity:
        return Activity.objects.get(
            group=self.group, type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value
        )

    @patch(METRICS_PATH)
    def test_creates_completion_activity_referencing_run(self, mock_metrics: MagicMock) -> None:
        # The delivered verdict is handed off via a SMART_ASSIGNMENT_COMPLETED
        # activity that points back at the Seer run and carries the resolved picks.
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        self._deliver(
            {
                "candidates": [
                    {"identifier": "alice", "identifier_kind": "username"},
                ]
            }
        )

        data = self._completion_activity().data
        assert data["run_id"] == self.seer_run.id
        assert data["run_uuid"] == str(self.seer_run.uuid)
        assert data["predicted_assignee_user_ids"] == [alice.id]

    @patch(METRICS_PATH)
    def test_redelivery_does_not_duplicate_activity(self, mock_metrics: MagicMock) -> None:
        # A Seer retry/redelivery re-invokes the handler for the same run: the second
        # delivery must not record a second completion activity (which would re-run
        # scoring/auto-assignment), and is reported as a distinct `duplicate` outcome.
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        verdict = {"candidates": [{"identifier": "alice", "identifier_kind": "username"}]}

        self._deliver(verdict)
        self._deliver(verdict)

        assert (
            Activity.objects.filter(
                group=self.group, type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value
            ).count()
            == 1
        )
        mock_metrics.incr.assert_any_call(
            "smart_assignment.delivery", tags={"outcome": "duplicate"}, sample_rate=1.0
        )

    @patch(METRICS_PATH)
    def test_error_status_records_nothing(self, mock_metrics: MagicMock) -> None:
        self._deliver(None, status="error", error="boom")
        # No prediction recorded on error; the Seer run holds the failure.
        assert "predicted_assignee_user_ids" not in self._extras()
        self._assert_outcome(mock_metrics, "error")

    @patch(METRICS_PATH)
    def test_untied_run_is_missing_group(self, mock_metrics: MagicMock) -> None:
        # Run mirror was never tied to a group (group_id is NULL): there's nothing to
        # record the prediction against, so it must not count as a delivery success.
        self.mirror.group = None
        self.mirror.save(update_fields=["group"])
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        self._deliver({"candidates": [{"identifier": "alice", "identifier_kind": "username"}]})

        assert not Activity.objects.filter(
            type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value
        ).exists()
        self._assert_outcome(mock_metrics, "missing_group")

    @patch(METRICS_PATH)
    def test_deleted_group_is_missing_group(self, mock_metrics: MagicMock) -> None:
        # Group deleted between dispatch and delivery (stale, dangling group_id): the
        # activity can't be created, so this is reported distinctly, not as a success.
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        self.group.delete()
        self._deliver({"candidates": [{"identifier": "alice", "identifier_kind": "username"}]})

        assert not Activity.objects.filter(
            type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value
        ).exists()
        self._assert_outcome(mock_metrics, "missing_group")

    @patch(METRICS_PATH)
    def test_missing_run_is_noop(self, mock_metrics: MagicMock) -> None:
        # Unknown run uuid: should not raise.
        deliver_smart_assignment_result(
            self.organization.id,
            UUID("00000000-0000-0000-0000-000000000000"),
            "completed",
            {"candidates": []},
            None,
        )
        self._assert_outcome(mock_metrics, "missing_run")
