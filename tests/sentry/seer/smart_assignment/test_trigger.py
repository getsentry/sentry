from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
from sentry.seer.smart_assignment.models import SEER_FEATURE_ID, SmartAssignmentScore
from sentry.seer.smart_assignment.scoring import record_prediction
from sentry.seer.smart_assignment.trigger import trigger_smart_assignment
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

CLIENT_PATH = "sentry.seer.smart_assignment.trigger.SeerAgentClient"
SCORING_METRICS_PATH = "sentry.seer.smart_assignment.scoring.metrics"

SEER_START_ACTIVITY_TYPES = (
    ActivityType.SEER_RCA_STARTED,
    ActivityType.SEER_SOLUTION_STARTED,
    ActivityType.SEER_CODING_STARTED,
)


class TriggerSmartAssignmentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def _wire_client(self, mock_client_cls: MagicMock) -> None:
        """Make start_feature_run create the SeerAgentRun mirror the real client
        would (source=SEER_FEATURE_ID, the group, and the seeded extras) and return the
        SeerRun -- so dedup and scoring see a realistic run."""

        def fake_start(**kwargs: object) -> SeerRun:
            payload = kwargs.get("payload") or {}
            assert isinstance(payload, dict)
            run = SeerRun.objects.create(
                organization=self.organization,
                type=SeerRunType.FEATURE_RUN,
                last_triggered_at=timezone.now(),
            )
            SeerAgentRun.objects.create(
                run=run,
                title=str(kwargs.get("title") or ""),
                source=str(kwargs["feature_id"]),
                group=Group.objects.get(id=payload["group_id"]),
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

    def _mirrors(self, group: Group | None = None) -> list[SeerAgentRun]:
        return list(
            SeerAgentRun.objects.filter(group_id=(group or self.group).id, source=SEER_FEATURE_ID)
        )

    def _activity(self, activity_type: ActivityType, user_id: int | None = None) -> Activity:
        return self.create_group_activity(
            group=self.group, type=activity_type.value, user_id=user_id
        )

    def _seer_started(self) -> Activity:
        return self._activity(ActivityType.SEER_RCA_STARTED)

    def _assigned_activity(
        self,
        assignee_id: int,
        assignee_type: str = "user",
        integration: str | None = None,
        group: Group | None = None,
    ) -> Activity:
        data = {"assignee": str(assignee_id), "assigneeType": assignee_type}
        if integration is not None:
            data["integration"] = integration
        return self.create_group_activity(
            group=group or self.group, type=ActivityType.ASSIGNED.value, data=data
        )

    @patch(CLIENT_PATH)
    def test_dispatch_creates_run_mirror(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )

        mirrors = self._mirrors()
        assert len(mirrors) == 1
        # The dispatch trigger (raw ActivityType name) is seeded on the extras for scoring.
        assert mirrors[0].extras["trigger"] == ActivityType.SEER_RCA_STARTED.name
        # A Seer AI-step start carries no ground truth.
        assert "actual_assignee_user_id" not in mirrors[0].extras

    @patch(CLIENT_PATH)
    def test_flag_disabled_is_noop(self, mock_client_cls: MagicMock) -> None:
        trigger_smart_assignment(self.group, ActivityType.SEER_RCA_STARTED, self._seer_started())
        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_dedup_skips_second_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._mirror(trigger=ActivityType.SEER_RCA_STARTED.name)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_assignment_dispatches_and_records_user(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 1.0}),
        ):
            trigger_smart_assignment(
                self.group, ActivityType.ASSIGNED, self._assigned_activity(assignee.id)
            )

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
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 1.0}),
        ):
            trigger_smart_assignment(
                self.group, ActivityType.ASSIGNED, self._assigned_activity(team.id, "team")
            )

        extras = self._mirrors()[0].extras
        assert extras["actual_assignee_team_id"] == team.id
        assert extras["actual_assignee_user_id"] is None

    @patch(CLIENT_PATH)
    def test_user_resolution_records_resolver_as_assignee(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        resolver = self.create_user()
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 1.0}),
        ):
            trigger_smart_assignment(
                self.group,
                ActivityType.SET_RESOLVED,
                self._activity(ActivityType.SET_RESOLVED, resolver.id),
            )

        extras = self._mirrors()[0].extras
        assert extras["trigger"] == ActivityType.SET_RESOLVED.name
        assert extras["actual_assignee_user_id"] == resolver.id
        assert extras["ground_truth_source"] == ActivityType.SET_RESOLVED.name

    @patch(CLIENT_PATH)
    def test_dispatch_stamps_triggering_activity(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        activity = self._seer_started()
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
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )

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
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )

        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_eval_sample_rate_zero_skips_assignment_dispatch(
        self, mock_client_cls: MagicMock
    ) -> None:
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 0.0}),
        ):
            trigger_smart_assignment(
                self.group, ActivityType.ASSIGNED, self._assigned_activity(assignee.id)
            )

        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_eval_sample_rate_does_not_gate_seer_starts(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 0.0}),
        ):
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )

        assert len(self._mirrors()) == 1

    @patch("sentry.seer.smart_assignment.trigger.random.random", return_value=0.05)
    @patch(CLIENT_PATH)
    def test_eval_sample_rate_admits_when_roll_is_below_rate(
        self, mock_client_cls: MagicMock, _mock_random: MagicMock
    ) -> None:
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 0.10}),
        ):
            trigger_smart_assignment(
                self.group, ActivityType.ASSIGNED, self._assigned_activity(assignee.id)
            )

        assert len(self._mirrors()) == 1

    @patch("sentry.seer.smart_assignment.trigger.random.random", return_value=0.50)
    @patch(CLIENT_PATH)
    def test_eval_sample_rate_rejects_when_roll_is_at_or_above_rate(
        self, mock_client_cls: MagicMock, _mock_random: MagicMock
    ) -> None:
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 0.10}),
        ):
            trigger_smart_assignment(
                self.group, ActivityType.ASSIGNED, self._assigned_activity(assignee.id)
            )

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
            trigger_smart_assignment(
                self.group, ActivityType.ASSIGNED, self._assigned_activity(assignee.id)
            )

        extras = self._mirrors()[0].extras
        assert extras["actual_assignee_user_id"] == assignee.id
        assert extras["ground_truth_source"] == ActivityType.ASSIGNED.name
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_automated_user_assignment_does_not_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group,
                ActivityType.ASSIGNED,
                self._assigned_activity(
                    assignee.id, integration=ActivityIntegration.PROJECT_OWNERSHIP.value
                ),
            )

        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_automated_team_assignment_does_not_dispatch(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        team = self.create_team(organization=self.organization)
        GroupAssignee.objects.create(group=self.group, project=self.group.project, team=team)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group,
                ActivityType.ASSIGNED,
                self._assigned_activity(
                    team.id, "team", integration=ActivityIntegration.CODEOWNERS.value
                ),
            )

        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_automated_assignment_leaves_a_waiting_run_untouched(
        self, mock_client_cls: MagicMock
    ) -> None:
        self._mirror(trigger=ActivityType.SEER_RCA_STARTED.name)
        team = self.create_team(organization=self.organization)
        GroupAssignee.objects.create(group=self.group, project=self.group.project, team=team)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group,
                ActivityType.ASSIGNED,
                self._assigned_activity(
                    team.id, "team", integration=ActivityIntegration.CODEOWNERS.value
                ),
            )

        extras = self._mirrors()[0].extras
        assert "actual_assignee_team_id" not in extras
        assert "actual_assignee_user_id" not in extras

    @patch(CLIENT_PATH)
    def test_seer_start_dispatches_on_an_automatically_assigned_issue(
        self, mock_client_cls: MagicMock
    ) -> None:
        # A Seer workflow still needs a person to notify, so the automated assignment
        # only blocks its own trigger.
        self._wire_client(mock_client_cls)
        team = self.create_team(organization=self.organization)
        GroupAssignee.objects.create(group=self.group, project=self.group.project, team=team)
        self._assigned_activity(team.id, "team", integration=ActivityIntegration.CODEOWNERS.value)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )

        mirrors = self._mirrors()
        assert len(mirrors) == 1
        # The automated assignment still can't be graded against.
        assert "actual_assignee_team_id" not in mirrors[0].extras

    @patch(CLIENT_PATH)
    def test_human_assignment_after_an_automated_one_dispatches(
        self, mock_client_cls: MagicMock
    ) -> None:
        # The automated event must not spend the one prediction this issue gets.
        self._wire_client(mock_client_cls)
        team = self.create_team(organization=self.organization)
        assignee = GroupAssignee.objects.create(
            group=self.group, project=self.group.project, team=team
        )
        human = self.create_user()
        with (
            self.feature("organizations:seer-smart-assignment-run"),
            self.options({"seer.smart_assignment.eval_sample_rate": 1.0}),
        ):
            trigger_smart_assignment(
                self.group,
                ActivityType.ASSIGNED,
                self._assigned_activity(
                    team.id, "team", integration=ActivityIntegration.PROJECT_OWNERSHIP.value
                ),
            )
            assert self._mirrors() == []

            assignee.update(team=None, user_id=human.id)
            trigger_smart_assignment(
                self.group, ActivityType.ASSIGNED, self._assigned_activity(human.id)
            )

        mirrors = self._mirrors()
        assert len(mirrors) == 1
        assert mirrors[0].extras["actual_assignee_user_id"] == human.id

    @patch(CLIENT_PATH)
    def test_every_seer_start_snapshots_an_existing_user_assignee(
        self, mock_client_cls: MagicMock
    ) -> None:
        # Without this the run has a prediction and no label, and nothing later is
        # guaranteed to supply one.
        self._wire_client(mock_client_cls)
        for activity_type in SEER_START_ACTIVITY_TYPES:
            group = self.create_group()
            assignee = self.create_user()
            GroupAssignee.objects.create(group=group, project=group.project, user_id=assignee.id)
            self._assigned_activity(assignee.id, group=group)
            with self.feature("organizations:seer-smart-assignment-run"):
                trigger_smart_assignment(
                    group,
                    activity_type,
                    self.create_group_activity(group=group, type=activity_type.value),
                )

            extras = self._mirrors(group)[0].extras
            assert extras["trigger"] == activity_type.name
            assert extras["actual_assignee_user_id"] == assignee.id
            assert extras["ground_truth_source"] == ActivityType.ASSIGNED.name

    @patch(CLIENT_PATH)
    def test_seer_start_snapshots_an_existing_team_assignee(
        self, mock_client_cls: MagicMock
    ) -> None:
        self._wire_client(mock_client_cls)
        team = self.create_team(organization=self.organization)
        GroupAssignee.objects.create(group=self.group, project=self.group.project, team=team)
        self._assigned_activity(team.id, "team")
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )

        extras = self._mirrors()[0].extras
        assert extras["actual_assignee_team_id"] == team.id
        assert extras["actual_assignee_user_id"] is None

    @patch(SCORING_METRICS_PATH)
    @patch(CLIENT_PATH)
    def test_repeated_seer_start_does_not_rewrite_truth(
        self, mock_client_cls: MagicMock, mock_metrics: MagicMock
    ) -> None:
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        self._assigned_activity(assignee.id)
        with self.feature("organizations:seer-smart-assignment-run"):
            for activity_type in (
                ActivityType.SEER_RCA_STARTED,
                ActivityType.SEER_SOLUTION_STARTED,
            ):
                trigger_smart_assignment(
                    self.group,
                    activity_type,
                    self.create_group_activity(group=self.group, type=activity_type.value),
                )

        # The second start sees identical truth, so it neither rewrites nor recounts it.
        recorded = [
            call
            for call in mock_metrics.incr.call_args_list
            if call.args and call.args[0] == "smart_assignment.ground_truth.recorded"
        ]
        assert len(recorded) == 1
        assert self._mirrors()[0].extras["actual_assignee_user_id"] == assignee.id

    @patch(SCORING_METRICS_PATH)
    @patch(CLIENT_PATH)
    def test_snapshotted_assignee_scores_when_the_prediction_lands(
        self, mock_client_cls: MagicMock, mock_metrics: MagicMock
    ) -> None:
        # The whole point of the snapshot: no assignment or resolution ever follows, and
        # the run still scores when Seer delivers.
        self._wire_client(mock_client_cls)
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        self._assigned_activity(assignee.id)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SEER_RCA_STARTED, self._seer_started()
            )

        record_prediction(self._mirrors()[0], [assignee.id], assignee.id)

        mock_metrics.incr.assert_any_call(
            "smart_assignment.scored",
            tags={
                "result": SmartAssignmentScore.EXACT,
                "hit_rank": 1,
                "trigger": ActivityType.SEER_RCA_STARTED.name,
            },
            sample_rate=1.0,
        )

    @patch(CLIENT_PATH)
    def test_automatic_resolution_is_skipped(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group, ActivityType.SET_RESOLVED, self._activity(ActivityType.SET_RESOLVED)
            )

        # No acting user -> not a signal, so we don't even dispatch a prediction.
        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()

    @patch(CLIENT_PATH)
    def test_integration_resolution_is_skipped(self, mock_client_cls: MagicMock) -> None:
        self._wire_client(mock_client_cls)
        proxy_user = self.create_user(is_sentry_app=True)
        with self.feature("organizations:seer-smart-assignment-run"):
            trigger_smart_assignment(
                self.group,
                ActivityType.SET_RESOLVED_IN_RELEASE,
                self._activity(ActivityType.SET_RESOLVED_IN_RELEASE, proxy_user.id),
            )

        assert self._mirrors() == []
        mock_client_cls.return_value.start_feature_run.assert_not_called()
