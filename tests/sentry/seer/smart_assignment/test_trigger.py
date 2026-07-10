from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.seer.models.run import SeerRun, SeerRunType
from sentry.seer.models.smart_assignment import (
    SeerSmartAssignmentResult,
    SmartAssignmentStatus,
    SmartAssignmentTrigger,
)
from sentry.seer.smart_assignment.trigger import (
    maybe_trigger_smart_assignment,
    record_ground_truth,
)
from sentry.testutils.cases import TestCase

TRIGGER_PATH = "sentry.seer.smart_assignment.trigger.SeerAgentClient"


class MaybeTriggerSmartAssignmentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def _wire_client(self, mock_client_cls: MagicMock) -> SeerRun:
        """Make start_feature_run invoke on_run_created with a real SeerRun."""
        seer_run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.FEATURE_RUN,
            last_triggered_at=timezone.now(),
        )

        def fake_start(**kwargs):
            kwargs["on_run_created"](seer_run)
            return seer_run

        mock_client_cls.return_value.start_feature_run.side_effect = fake_start
        return seer_run

    @patch(TRIGGER_PATH)
    def test_dispatch_creates_pending_row(self, mock_client_cls: MagicMock) -> None:
        seer_run = self._wire_client(mock_client_cls)
        with self.feature("organizations:seer-smart-assignment"):
            maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)

        row = SeerSmartAssignmentResult.objects.get(group=self.group)
        assert row.trigger == SmartAssignmentTrigger.PR_CREATED
        assert row.status == SmartAssignmentStatus.PENDING
        assert row.result_seer_run_id == seer_run.id

    @patch(TRIGGER_PATH)
    def test_flag_disabled_is_noop(self, mock_client_cls: MagicMock) -> None:
        maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)
        assert not SeerSmartAssignmentResult.objects.filter(group=self.group).exists()
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(TRIGGER_PATH)
    def test_dedup_skips_second_trigger(self, mock_client_cls: MagicMock) -> None:
        SeerSmartAssignmentResult.objects.create(
            organization=self.organization,
            group=self.group,
            trigger=SmartAssignmentTrigger.PR_CREATED,
            status=SmartAssignmentStatus.PENDING,
        )
        with self.feature("organizations:seer-smart-assignment"):
            maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)
        mock_client_cls.return_value.start_feature_run.assert_not_called()


class RecordGroundTruthTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def test_noop_without_row(self) -> None:
        record_ground_truth(self.group, assignee_user_id=self.user.id)
        assert not SeerSmartAssignmentResult.objects.filter(group=self.group).exists()

    def test_records_assignee_and_resolver(self) -> None:
        row = SeerSmartAssignmentResult.objects.create(
            organization=self.organization,
            group=self.group,
            trigger=SmartAssignmentTrigger.PR_CREATED,
            status=SmartAssignmentStatus.PENDING,
        )
        assignee = self.create_user()
        resolver = self.create_user()

        record_ground_truth(self.group, assignee_user_id=assignee.id)
        record_ground_truth(self.group, resolver_user_id=resolver.id)

        row.refresh_from_db()
        assert row.actual_assignee_user_id == assignee.id
        assert row.actual_resolver_user_id == resolver.id
        assert row.assigned_at is not None
        assert row.resolved_at is not None
