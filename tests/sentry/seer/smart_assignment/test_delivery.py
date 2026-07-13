from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.seer.models.run import SeerRun, SeerRunType
from sentry.seer.models.smart_assignment import (
    SeerSmartAssignmentResult,
    SmartAssignmentStatus,
    SmartAssignmentTrigger,
)
from sentry.seer.smart_assignment.delivery import deliver_smart_assignment_result
from sentry.testutils.cases import TestCase

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
        self.row = SeerSmartAssignmentResult.objects.create(
            organization=self.organization,
            group=self.group,
            result_seer_run=self.seer_run,
            trigger=SmartAssignmentTrigger.PR_CREATED,
            status=SmartAssignmentStatus.PENDING,
        )

    def _assert_outcome(self, mock_metrics: MagicMock, expected: str) -> None:
        mock_metrics.incr.assert_called_once_with(
            "smart_assignment.delivery", tags={"outcome": expected}
        )

    @patch(METRICS_PATH)
    def test_records_verdict_resolving_top_pick_to_user(self, mock_metrics: MagicMock) -> None:
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        result = {
            "candidates": [
                {
                    "identifier": "@alice",
                    "identifier_kind": "username",
                    "reason": "suspect commit",
                    "confidence": "high",
                },
                {
                    "identifier": "@bob",
                    "identifier_kind": "username",
                    "reason": "code owner",
                    "confidence": "low",
                },
            ]
        }
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "completed", result, None
        )

        self.row.refresh_from_db()
        assert self.row.status == SmartAssignmentStatus.COMPLETED
        # Top pick resolved to a real user; raw string still lives in the verdict.
        assert self.row.predicted_assignee_user_id == alice.id
        assert self.row.verdict == result
        self._assert_outcome(mock_metrics, "resolved")

    @patch(METRICS_PATH)
    def test_email_kind_resolves_by_verified_email(self, mock_metrics: MagicMock) -> None:
        # An email-kind pick (unlinked commit author) resolves by verified org email,
        # even when the address happens to also be someone's username-shaped handle.
        carol = self.create_user(email="carol@example.com")
        self.create_member(user=carol, organization=self.organization)
        result = {
            "candidates": [
                {
                    "identifier": "carol@example.com",
                    "identifier_kind": "email",
                    "reason": "unlinked commit author",
                    "confidence": "low",
                },
            ]
        }
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "completed", result, None
        )

        self.row.refresh_from_db()
        assert self.row.predicted_assignee_user_id == carol.id
        self._assert_outcome(mock_metrics, "resolved")

    @patch(METRICS_PATH)
    def test_unresolvable_identifier_completes_with_no_user(self, mock_metrics: MagicMock) -> None:
        result = {
            "candidates": [
                {
                    "identifier": "@nobody-here",
                    "identifier_kind": "username",
                    "reason": "guess",
                    "confidence": "low",
                },
            ]
        }
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "completed", result, None
        )

        self.row.refresh_from_db()
        assert self.row.status == SmartAssignmentStatus.COMPLETED
        assert self.row.predicted_assignee_user_id is None
        # The raw identifier is still recoverable from the stored verdict.
        assert self.row.verdict == result
        self._assert_outcome(mock_metrics, "unlinked")

    @patch(METRICS_PATH)
    def test_empty_candidates_is_completed_with_no_prediction(
        self, mock_metrics: MagicMock
    ) -> None:
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "completed", {"candidates": []}, None
        )
        self.row.refresh_from_db()
        assert self.row.status == SmartAssignmentStatus.COMPLETED
        assert self.row.predicted_assignee_user_id is None
        self._assert_outcome(mock_metrics, "abstain")

    @patch(METRICS_PATH)
    def test_error_status_marks_row_error(self, mock_metrics: MagicMock) -> None:
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "error", None, "boom"
        )
        self.row.refresh_from_db()
        assert self.row.status == SmartAssignmentStatus.ERROR
        assert self.row.extras.get("error") == "boom"
        self._assert_outcome(mock_metrics, "error")

    @patch("sentry.seer.smart_assignment.scoring.metrics")
    def test_scores_when_ground_truth_already_present(
        self, mock_scoring_metrics: MagicMock
    ) -> None:
        # Assignment landed before Seer finished: ground truth is already on the row,
        # so delivering the prediction should complete the pair and score it.
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        self.row.update(actual_assignee_user_id=alice.id)
        result = {
            "candidates": [
                {
                    "identifier": "@alice",
                    "identifier_kind": "username",
                    "reason": "x",
                    "confidence": "high",
                }
            ]
        }

        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "completed", result, None
        )

        mock_scoring_metrics.incr.assert_called_once_with(
            "smart_assignment.scored",
            tags={"result": "exact", "trigger": SmartAssignmentTrigger.PR_CREATED},
        )

    @patch(METRICS_PATH)
    def test_missing_row_is_noop(self, mock_metrics: MagicMock) -> None:
        # Unknown run uuid: should not raise.
        deliver_smart_assignment_result(
            self.organization.id,
            "00000000-0000-0000-0000-000000000000",
            "completed",
            {"candidates": []},
            None,
        )
        self._assert_outcome(mock_metrics, "missing_row")
