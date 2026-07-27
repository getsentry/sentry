from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.groupassignee import GroupAssignee
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
from sentry.seer.smart_assignment.models import SEER_FEATURE_ID
from sentry.seer.smart_assignment.trigger import trigger_smart_assignment
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

CLIENT_PATH = "sentry.seer.smart_assignment.trigger.SeerAgentClient"


class TriggerSmartAssignmentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def _wire_client(self, mock_client_cls: MagicMock) -> None:
        """Make start_feature_run create the SeerAgentRun mirror the real client
        would (source=SEER_FEATURE_ID, the group, and the seeded extras) and return the
        SeerRun -- so dedup and scoring see a realistic run."""

        def fake_start(**kwargs: object) -> SeerRun:
            run = SeerRun.objects.create(
                organization=self.organization,
                type=SeerRunType.FEATURE_RUN,
                last_triggered_at=timezone.now(),
            )
            SeerAgentRun.objects.create(
                run=run,
                title=str(kwargs.get("title") or ""),
                source=str(kwargs["feature_id"]),
                group=self.group,
                extras=kwargs.get("extras") or {},
            )
            return run

        mock_client_cls.return_value.start_feature_run.side_effect = fake_start

    def _mirror(self, **extras: object) -> SeerAgentRun:
        run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.FEATURE_RUN,
            last_triggered_at=timezone.now(),
        )
        return SeerAgentRun.objects.create(
            run=run, source=SEER_FEATURE_ID, group=self.group, extras=extras
        )

    def _mirrors(self) -> list[SeerAgentRun]:
        return list(SeerAgentRun.objects.filter(group_id=self.group.id, source=SEER_FEATURE_ID))

    def _resolved_activity(self, user_id: int | None = None) -> Activity:
        return self.create_group_activity(
            group=self.group, type=ActivityType.SET_RESOLVED.value, user_id=user_id
        )

    @patch(CLIENT_PATH)
    def test_dispatch_creates_run_mirror(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(self.group, ActivityType.SEER_RCA_STARTED)

        mirrors = self._mirrors()
        assert len(mirrors) == 1
        # The dispatch trigger (raw ActivityType name) is seeded on the extras for scoring.
        assert mirrors[0].extras["trigger"] == ActivityType.SEER_RCA_STARTED.name
        # A Seer AI-step start carries no ground truth (and no activity was passed to stamp).
        assert "actual_assignee_user_id" not in mirrors[0].extras
        assert "triggering_activity_id" not in mirrors[0].extras

    @patch(CLIENT_PATH)
    def test_flag_disabled_is_noop(self, mock_client_cls: MagicMock) -> None:
        trigger_smart_assignment(self.group, ActivityType.SEER_RCA_STARTED)
        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_dedup_skips_second_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._mirror(trigger=ActivityType.SEER_RCA_STARTED.name)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(self.group, ActivityType.SEER_RCA_STARTED)
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_assignment_dispatches_and_records_user(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(self.group, ActivityType.ASSIGNED)

        mirrors = self._mirrors()
        assert len(mirrors) == 1
        extras = mirrors[0].extras
        assert extras["trigger"] == ActivityType.ASSIGNED.name
        assert extras["actual_assignee_user_id"] == assignee.id
        assert extras["actual_assignee_team_id"] is None
        assert extras["ground_truth_source"] == ActivityType.ASSIGNED.name

    @patch(CLIENT_PATH)
    def test_assignment_records_team(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        team = self.create_team(organization=self.organization)
        GroupAssignee.objects.create(group=self.group, project=self.group.project, team=team)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(self.group, ActivityType.ASSIGNED)

        extras = self._mirrors()[0].extras
        assert extras["actual_assignee_team_id"] == team.id
        assert extras["actual_assignee_user_id"] is None

    @patch(CLIENT_PATH)
    def test_user_resolution_records_resolver_as_assignee(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        resolver = self.create_user()
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SET_RESOLVED, self._resolved_activity(resolver.id)
            )

        extras = self._mirrors()[0].extras
        assert extras["trigger"] == ActivityType.SET_RESOLVED.name
        assert extras["actual_assignee_user_id"] == resolver.id
        assert extras["ground_truth_source"] == ActivityType.SET_RESOLVED.name

    @patch(CLIENT_PATH)
    def test_dispatch_stamps_triggering_activity(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_RCA_STARTED.value
        )
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(self.group, ActivityType.SEER_RCA_STARTED, activity)

        mirror = self._mirrors()[0]
        assert mirror.extras["triggering_activity_id"] == activity.id
        # The activity points back at the run it kicked off.
        activity.refresh_from_db()
        pointer = activity.data["seer_smart_assignment"]
        assert pointer["run_id"] == mirror.run_id
        assert pointer["run_uuid"] == str(mirror.run.uuid)

    @patch(CLIENT_PATH)
    def test_org_rate_limit_skips_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.max_dispatches_per_org_per_day": 0}),
        ):
            trigger_smart_assignment(self.group, ActivityType.SEER_RCA_STARTED)

        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_global_rate_limit_skips_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        # Org cap is generous; the global cap is what trips here.
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.max_dispatches_per_day": 0}),
        ):
            trigger_smart_assignment(self.group, ActivityType.SEER_RCA_STARTED)

        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_rate_limit_still_records_ground_truth(self, mock_client_cls: MagicMock) -> None:
        # An issue predicted earlier still gets ground truth even once caps are
        # exhausted -- the caps only gate new dispatches.
        self._mirror(trigger=ActivityType.SEER_RCA_STARTED.name)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options(
                {
                    "seer.smart_assignment.max_dispatches_per_org_per_day": 0,
                    "seer.smart_assignment.max_dispatches_per_day": 0,
                }
            ),
        ):
            trigger_smart_assignment(self.group, ActivityType.ASSIGNED)

        extras = self._mirrors()[0].extras
        assert extras["actual_assignee_user_id"] == assignee.id
        assert extras["ground_truth_source"] == ActivityType.ASSIGNED.name
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_automatic_resolution_is_skipped(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SET_RESOLVED, self._resolved_activity(None)
            )

        # No acting user -> not a signal, so we don't even dispatch a prediction.
        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()
