from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.seer.models.run import SeerRun, SeerRunType
from sentry.seer.models.smart_assignment import (
    SeerSmartAssignmentResult,
    SmartAssignmentStatus,
    SmartAssignmentTrigger,
)
from sentry.seer.smart_assignment.trigger import maybe_trigger_smart_assignment
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

CLIENT_PATH = "sentry.seer.smart_assignment.trigger.SeerAgentClient"


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

        def fake_start(**kwargs: object) -> SeerRun:
            on_run_created = kwargs["on_run_created"]
            assert callable(on_run_created)
            on_run_created(seer_run)
            return seer_run

        mock_client_cls.return_value.start_feature_run.side_effect = fake_start
        return seer_run

    def _resolved_activity(self, user_id: int | None = None) -> Activity:
        return self.create_group_activity(
            group=self.group, type=ActivityType.SET_RESOLVED.value, user_id=user_id
        )

    @patch(CLIENT_PATH)
    def test_dispatch_creates_pending_row(self, mock_client_cls: MagicMock) -> None:
        seer_run = self._wire_client(mock_client_cls)
        with self.feature("organizations:seer-smart-assignment-run"):
            maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)

        row = SeerSmartAssignmentResult.objects.get(group=self.group)
        assert row.trigger == SmartAssignmentTrigger.PR_CREATED
        assert row.status == SmartAssignmentStatus.PENDING
        assert row.result_seer_run_id == seer_run.id
        # PR creation carries no ground truth.
        assert row.actual_assignee_user_id is None
        assert row.ground_truth_source is None

    @patch(CLIENT_PATH)
    def test_flag_disabled_is_noop(self, mock_client_cls: MagicMock) -> None:
        maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)
        assert not SeerSmartAssignmentResult.objects.filter(group=self.group).exists()
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_dedup_skips_second_dispatch(self, mock_client_cls: MagicMock) -> None:
        SeerSmartAssignmentResult.objects.create(
            organization=self.organization,
            group=self.group,
            trigger=SmartAssignmentTrigger.PR_CREATED,
            status=SmartAssignmentStatus.PENDING,
        )
        with self.feature("organizations:seer-smart-assignment-run"):
            maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_org_rate_limit_skips_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.max_dispatches_per_org_per_day": 0}),
        ):
            maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)

        assert not SeerSmartAssignmentResult.objects.filter(group=self.group).exists()
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_global_rate_limit_skips_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        # Org cap is generous; the global cap is what trips here.
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.max_dispatches_per_day": 0}),
        ):
            maybe_trigger_smart_assignment(self.group, SmartAssignmentTrigger.PR_CREATED)

        assert not SeerSmartAssignmentResult.objects.filter(group=self.group).exists()
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_automatic_resolution_is_skipped(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with self.feature("organizations:seer-smart-assignment-run"):
            maybe_trigger_smart_assignment(
                self.group, SmartAssignmentTrigger.RESOLUTION, self._resolved_activity(None)
            )

        # No acting user -> not a signal, so we don't even dispatch a prediction.
        assert not SeerSmartAssignmentResult.objects.filter(group=self.group).exists()
        mock_client_cls.return_value.start_feature_run.assert_not_called()
