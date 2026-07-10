from django.utils import timezone

from sentry.seer.models.run import SeerRun, SeerRunType
from sentry.seer.models.smart_assignment import (
    SeerSmartAssignmentResult,
    SmartAssignmentStatus,
    SmartAssignmentTrigger,
)
from sentry.seer.smart_assignment.delivery import deliver_smart_assignment_result
from sentry.testutils.cases import TestCase


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
            trigger=SmartAssignmentTrigger.SOLUTION_COMPLETED,
            status=SmartAssignmentStatus.PENDING,
        )

    def test_records_verdict(self) -> None:
        result = {
            "candidates": [
                {"identifier": "@alice", "reason": "suspect commit", "confidence": "high"},
                {"identifier": "@bob", "reason": "code owner", "confidence": "low"},
            ]
        }
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "completed", result, None
        )

        self.row.refresh_from_db()
        assert self.row.status == SmartAssignmentStatus.COMPLETED
        assert self.row.predicted_identifier == "@alice"
        assert self.row.verdict == result

    def test_empty_candidates_is_completed_with_no_prediction(self) -> None:
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "completed", {"candidates": []}, None
        )
        self.row.refresh_from_db()
        assert self.row.status == SmartAssignmentStatus.COMPLETED
        assert self.row.predicted_identifier is None

    def test_error_status_marks_row_error(self) -> None:
        deliver_smart_assignment_result(
            self.organization.id, str(self.seer_run.uuid), "error", None, "boom"
        )
        self.row.refresh_from_db()
        assert self.row.status == SmartAssignmentStatus.ERROR
        assert self.row.extras.get("error") == "boom"

    def test_missing_row_is_noop(self) -> None:
        # Unknown run uuid: should not raise.
        deliver_smart_assignment_result(
            self.organization.id,
            "00000000-0000-0000-0000-000000000000",
            "completed",
            {"candidates": []},
            None,
        )
