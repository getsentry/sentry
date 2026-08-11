from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.team import Team
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
from sentry.seer.smart_assignment.models import SEER_FEATURE_ID, SmartAssignmentScore
from sentry.seer.smart_assignment.scoring import (
    record_ground_truth,
    record_prediction,
)
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

METRICS_PATH = "sentry.seer.smart_assignment.scoring.metrics"

# A representative dispatch trigger (a Seer AI-step start): its ActivityType name is
# what gets seeded on the run mirror's `extras["trigger"]`.
STARTED = ActivityType.SEER_RCA_STARTED

# The `extra` an ownership rule stamps onto the ASSIGNED activity it writes.
RULE_ORIGIN = {"integration": ActivityIntegration.CODEOWNERS.value}


class ScoringTestBase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def _run(
        self, group: Group | None = None, trigger: str = STARTED.name, **extras: object
    ) -> SeerAgentRun:
        seer_run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.FEATURE_RUN,
            last_triggered_at=timezone.now(),
        )
        return SeerAgentRun.objects.create(
            run=seer_run,
            source=SEER_FEATURE_ID,
            group=group or self.group,
            extras={"trigger": trigger, **extras},
        )


class RecordPredictionScoringTest(ScoringTestBase):
    def _assert_result(self, mock_metrics: MagicMock, expected: str, hit_rank: int = 0) -> None:
        mock_metrics.incr.assert_called_once_with(
            "smart_assignment.scored",
            tags={"result": expected, "hit_rank": hit_rank, "trigger": STARTED.name},
            sample_rate=1.0,
        )

    @patch(METRICS_PATH)
    def test_exact_when_prediction_matches_user(self, mock_metrics: MagicMock) -> None:
        user = self.create_user()
        run = self._run(actual_assignee_user_id=user.id)
        record_prediction(run, [user.id], user.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.EXACT, hit_rank=1)
        run.refresh_from_db()
        assert run.extras["result"] == SmartAssignmentScore.EXACT
        assert run.extras["hit_rank"] == 1

    @patch(METRICS_PATH)
    def test_team_when_predicted_user_on_assigned_team(self, mock_metrics: MagicMock) -> None:
        team = self.create_team(organization=self.organization)
        alice = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team])
        run = self._run(actual_assignee_team_id=team.id)
        record_prediction(run, [alice.id], alice.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.TEAM)

    @patch(METRICS_PATH)
    def test_shared_team_when_predicted_shares_team_with_actual_user(
        self, mock_metrics: MagicMock
    ) -> None:
        team = self.create_team(organization=self.organization)
        alice = self.create_user()
        bob = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team])
        self.create_member(user=bob, organization=self.organization, teams=[team])
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id], alice.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.SHARED_TEAM)

    @patch(METRICS_PATH)
    def test_miss_when_no_team_overlap(self, mock_metrics: MagicMock) -> None:
        team_a = self.create_team(organization=self.organization)
        team_b = self.create_team(organization=self.organization)
        alice = self.create_user()
        bob = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team_a])
        self.create_member(user=bob, organization=self.organization, teams=[team_b])
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id], alice.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS)

    @patch(METRICS_PATH)
    def test_exact_when_selected_user_follows_an_unmapped_candidate(
        self, mock_metrics: MagicMock
    ) -> None:
        # The top candidate never mapped to an org user, so completion suggested the
        # second one -- the pick that reached the issue is the pick we grade.
        alice = self.create_user()
        run = self._run(actual_assignee_user_id=alice.id)
        record_prediction(run, [None, alice.id], alice.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.EXACT, hit_rank=2)

    @patch(METRICS_PATH)
    def test_shared_team_when_selected_user_follows_an_unmapped_candidate(
        self, mock_metrics: MagicMock
    ) -> None:
        team = self.create_team(organization=self.organization)
        alice = self.create_user()
        bob = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team])
        self.create_member(user=bob, organization=self.organization, teams=[team])
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [None, alice.id], alice.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.SHARED_TEAM)

    def test_records_the_selected_candidate(self) -> None:
        alice = self.create_user()
        run = self._run()
        record_prediction(run, [None, alice.id], alice.id)

        run.refresh_from_db()
        assert run.extras["selected_assignee_user_id"] == alice.id

    @patch(METRICS_PATH)
    def test_miss_when_no_candidate_maps_to_a_user(self, mock_metrics: MagicMock) -> None:
        run = self._run(actual_assignee_user_id=self.create_user().id)
        record_prediction(run, [None, None], None)

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS)

    @patch(METRICS_PATH)
    def test_hit_rank_when_actual_is_lower_candidate(self, mock_metrics: MagicMock) -> None:
        # Top pick is wrong (and shares no team with the actual assignee, so it's a
        # miss), but the actual assignee is the second-ranked candidate -- still a hit.
        alice = self.create_user()
        bob = self.create_user()
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id, bob.id], alice.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=2)

    @patch(METRICS_PATH)
    def test_no_hit_rank_when_actual_absent_from_candidates(self, mock_metrics: MagicMock) -> None:
        alice = self.create_user()
        bob = self.create_user()
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id], alice.id)

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=0)

    @patch(METRICS_PATH)
    def test_unresolved_top_pick_alone_is_miss(self, mock_metrics: MagicMock) -> None:
        bob = self.create_user()
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [None], None)

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=0)

    @patch(METRICS_PATH)
    def test_unresolved_top_pick_with_team_truth_is_miss(self, mock_metrics: MagicMock) -> None:
        # Team-only ground truth with an unresolved top pick must not read as an EXACT
        # match on the None == None comparison.
        team = self.create_team(organization=self.organization)
        run = self._run(actual_assignee_team_id=team.id)
        record_prediction(run, [None], None)

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=0)

    @patch(METRICS_PATH)
    def test_noop_without_both_sides(self, mock_metrics: MagicMock) -> None:
        # Prediction but no ground truth yet.
        run = self._run()
        record_prediction(run, [7], 7)
        # Ground truth but no (resolvable) prediction (separate group).
        other = self.create_group()
        other_run = self._run(group=other, actual_assignee_user_id=9)
        record_prediction(other_run, [], None)
        mock_metrics.incr.assert_not_called()

    @patch(METRICS_PATH)
    def test_scores_only_once(self, mock_metrics: MagicMock) -> None:
        user = self.create_user()
        run = self._run(actual_assignee_user_id=user.id)
        record_prediction(run, [user.id], user.id)
        record_prediction(run, [user.id], user.id)
        assert mock_metrics.incr.call_count == 1


class RecordGroundTruthTest(ScoringTestBase):
    def _activity(self, activity_type: ActivityType, user_id: int | None = None) -> Activity:
        return self.create_group_activity(
            group=self.group, type=activity_type.value, user_id=user_id
        )

    def _assigned_activity(self, assignee_id: int, integration: str | None = None) -> Activity:
        data = {"assignee": str(assignee_id), "assigneeType": "user"}
        if integration is not None:
            data["integration"] = integration
        return self.create_group_activity(
            group=self.group, type=ActivityType.ASSIGNED.value, data=data
        )

    def _assign_team(self, integration: str | None = None) -> tuple[Team, Activity]:
        team = self.create_team(organization=self.organization)
        GroupAssignee.objects.create(group=self.group, project=self.group.project, team=team)
        data = {"assignee": str(team.id), "assigneeType": "team"}
        if integration is not None:
            data["integration"] = integration
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.ASSIGNED.value, data=data
        )
        return team, activity

    def test_noop_without_run(self) -> None:
        record_ground_truth(
            self.group,
            ActivityType.SET_RESOLVED,
            self._activity(ActivityType.SET_RESOLVED, self.user.id),
        )
        assert not SeerAgentRun.objects.filter(
            group_id=self.group.id, source=SEER_FEATURE_ID
        ).exists()

    def test_scores_a_prediction_recorded_before_the_selected_field(self) -> None:
        # A run whose prediction landed before `selected_assignee_user_id` existed still
        # scores, off its top slot.
        alice = self.create_user()
        run = self._run(predicted_assignee_user_ids=[alice.id])
        GroupAssignee.objects.create(group=self.group, project=self.group.project, user_id=alice.id)
        record_ground_truth(self.group, ActivityType.ASSIGNED, self._assigned_activity(alice.id))

        run.refresh_from_db()
        assert run.extras["result"] == SmartAssignmentScore.EXACT
        assert run.extras["hit_rank"] == 1

    def test_records_assignee_user(self) -> None:
        run = self._run()
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        record_ground_truth(self.group, ActivityType.ASSIGNED, self._assigned_activity(assignee.id))

        run.refresh_from_db()
        assert run.extras["actual_assignee_user_id"] == assignee.id
        assert run.extras["ground_truth_source"] == ActivityType.ASSIGNED.name

    def test_resolution_keeps_team_truth_over_resolver(self) -> None:
        team = self.create_team(organization=self.organization)
        run = self._run(actual_assignee_team_id=team.id)
        resolver = self.create_user()
        record_ground_truth(
            self.group,
            ActivityType.SET_RESOLVED,
            self._activity(ActivityType.SET_RESOLVED, resolver.id),
        )

        run.refresh_from_db()
        # A prior team assignee is enough truth; the resolver isn't recorded.
        assert "actual_assignee_user_id" not in run.extras
        assert run.extras["actual_assignee_team_id"] == team.id

    def test_automatic_resolution_is_noop(self) -> None:
        run = self._run()
        record_ground_truth(
            self.group, ActivityType.SET_RESOLVED, self._activity(ActivityType.SET_RESOLVED)
        )

        run.refresh_from_db()
        assert "actual_assignee_user_id" not in run.extras
        assert "ground_truth_source" not in run.extras

    def test_resolution_by_sentry_app_proxy_user_is_noop(self) -> None:
        run = self._run()
        proxy_user = self.create_user(is_sentry_app=True)
        record_ground_truth(
            self.group,
            ActivityType.SET_RESOLVED_IN_RELEASE,
            self._activity(ActivityType.SET_RESOLVED_IN_RELEASE, proxy_user.id),
        )

        run.refresh_from_db()
        assert "actual_assignee_user_id" not in run.extras
        assert "ground_truth_source" not in run.extras

    def test_seer_start_is_noop(self) -> None:
        run = self._run()
        record_ground_truth(
            self.group, ActivityType.SEER_RCA_STARTED, self._activity(ActivityType.SEER_RCA_STARTED)
        )

        run.refresh_from_db()
        assert "ground_truth_source" not in run.extras

    def test_our_auto_assignment_is_not_recorded(self) -> None:
        run = self._run()
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        activity = self._assigned_activity(
            assignee.id, integration=ActivityIntegration.SEER_SUGGESTED.value
        )
        record_ground_truth(self.group, ActivityType.ASSIGNED, activity)

        run.refresh_from_db()
        assert "actual_assignee_user_id" not in run.extras
        assert "ground_truth_source" not in run.extras

    def test_ownership_rule_team_assignment_is_not_recorded(self) -> None:
        # The agent reaches this team itself (get_issue_ownership -> get_team_members),
        # so grading against it would score the routing config, not a prediction.
        run = self._run()
        _, activity = self._assign_team(integration=ActivityIntegration.PROJECT_OWNERSHIP.value)
        record_ground_truth(self.group, ActivityType.ASSIGNED, activity)

        run.refresh_from_db()
        assert "actual_assignee_team_id" not in run.extras
        assert "ground_truth_source" not in run.extras

    def test_codeowners_team_assignment_is_not_recorded(self) -> None:
        run = self._run()
        _, activity = self._assign_team(integration=ActivityIntegration.CODEOWNERS.value)
        record_ground_truth(self.group, ActivityType.ASSIGNED, activity)

        run.refresh_from_db()
        assert "actual_assignee_team_id" not in run.extras

    def test_predicted_team_member_scores_no_hit_on_rule_assigned_team(self) -> None:
        # The cheat this guards: a rule assigns the owning team, the agent expands that
        # team and names one of its members, and the shared team reads as partial credit.
        alice = self.create_user()
        run = self._run(predicted_assignee_user_ids=[alice.id])
        team, activity = self._assign_team(integration=ActivityIntegration.CODEOWNERS.value)
        self.create_member(user=alice, organization=self.organization, teams=[team])
        record_ground_truth(self.group, ActivityType.ASSIGNED, activity)

        run.refresh_from_db()
        assert "result" not in run.extras
        assert "actual_assignee_team_id" not in run.extras

    def test_manually_assigned_team_is_recorded(self) -> None:
        run = self._run()
        team, activity = self._assign_team()
        record_ground_truth(self.group, ActivityType.ASSIGNED, activity)

        run.refresh_from_db()
        assert run.extras["actual_assignee_team_id"] == team.id
        assert run.extras["ground_truth_source"] == ActivityType.ASSIGNED.name

    def test_suspect_commit_assignment_is_not_recorded(self) -> None:
        # The same author get_issue_committers hands the agent.
        run = self._run()
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        activity = self._assigned_activity(
            assignee.id, integration=ActivityIntegration.SUSPECT_COMMITTER.value
        )
        record_ground_truth(self.group, ActivityType.ASSIGNED, activity)

        run.refresh_from_db()
        assert "actual_assignee_user_id" not in run.extras

    def test_human_reassignment_over_rule_assignment_is_recorded(self) -> None:
        run = self._run()
        self._assign_team(integration=ActivityIntegration.PROJECT_OWNERSHIP.value)
        human_assignee = self.create_user()
        GroupAssignee.objects.filter(group=self.group).update(
            team_id=None, user_id=human_assignee.id
        )
        record_ground_truth(
            self.group, ActivityType.ASSIGNED, self._assigned_activity(human_assignee.id)
        )

        run.refresh_from_db()
        assert run.extras["actual_assignee_user_id"] == human_assignee.id

    def test_resolution_ignores_rule_assignment(self) -> None:
        run = self._run()
        self._assign_team(integration=ActivityIntegration.CODEOWNERS.value)
        resolver = self.create_user()
        record_ground_truth(
            self.group,
            ActivityType.SET_RESOLVED,
            self._activity(ActivityType.SET_RESOLVED, resolver.id),
        )

        run.refresh_from_db()
        assert "actual_assignee_team_id" not in run.extras
        assert run.extras["actual_assignee_user_id"] == resolver.id
        assert run.extras["ground_truth_source"] == ActivityType.SET_RESOLVED.name

    def _seer_auto_assign(self, assignee_id: int) -> Activity:
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee_id
        )
        return self._assigned_activity(
            assignee_id, integration=ActivityIntegration.SEER_SUGGESTED.value
        )

    def test_resolution_ignores_seer_auto_assignment(self) -> None:
        # Seer auto-assigned (never reassigned by a human); a human resolves. The
        # auto-assignment must not become ground truth -- that would score us against
        # ourselves -- so the resolver is recorded as the fallback truth instead.
        run = self._run()
        seer_assignee = self.create_user()
        self._seer_auto_assign(seer_assignee.id)
        resolver = self.create_user()
        record_ground_truth(
            self.group,
            ActivityType.SET_RESOLVED,
            self._activity(ActivityType.SET_RESOLVED, resolver.id),
        )

        run.refresh_from_db()
        assert run.extras["actual_assignee_user_id"] == resolver.id
        assert run.extras["ground_truth_source"] == ActivityType.SET_RESOLVED.name

    def test_resolution_records_human_reassignment_over_seer(self) -> None:
        # A human reassigns after Seer auto-assigned (a new, untagged ASSIGNED
        # activity), so on resolution the human assignee is honored as ground truth.
        run = self._run()
        seer_assignee = self.create_user()
        self._seer_auto_assign(seer_assignee.id)
        human_assignee = self.create_user()
        GroupAssignee.objects.filter(group=self.group).update(user_id=human_assignee.id)
        self._assigned_activity(human_assignee.id)
        record_ground_truth(
            self.group,
            ActivityType.SET_RESOLVED,
            self._activity(ActivityType.SET_RESOLVED, self.create_user().id),
        )

        run.refresh_from_db()
        assert run.extras["actual_assignee_user_id"] == human_assignee.id
        assert run.extras["ground_truth_source"] == ActivityType.ASSIGNED.name

    @patch(METRICS_PATH)
    def test_records_ground_truth_scores_existing_prediction(self, mock_metrics: MagicMock) -> None:
        # Prediction already delivered; recording the matching assignment as ground
        # truth completes the pair and scores it exact (tagged with the dispatch
        # trigger, not the ground-truth event).
        assignee = self.create_user()
        self._run(predicted_assignee_user_ids=[assignee.id])
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        record_ground_truth(self.group, ActivityType.ASSIGNED, self._assigned_activity(assignee.id))

        mock_metrics.incr.assert_any_call(
            "smart_assignment.scored",
            tags={"result": SmartAssignmentScore.EXACT, "hit_rank": 1, "trigger": STARTED.name},
            sample_rate=1.0,
        )

    def test_resolution_does_not_overwrite_existing_assignee(self) -> None:
        assignee = self.create_user()
        run = self._run(
            actual_assignee_user_id=assignee.id,
            ground_truth_source=ActivityType.ASSIGNED.name,
        )
        resolver = self.create_user()
        record_ground_truth(
            self.group,
            ActivityType.SET_RESOLVED,
            self._activity(ActivityType.SET_RESOLVED, resolver.id),
        )

        run.refresh_from_db()
        assert run.extras["actual_assignee_user_id"] == assignee.id
        assert run.extras["ground_truth_source"] == ActivityType.ASSIGNED.name


class AssignmentOriginTest(ScoringTestBase):
    """Which assignment the origin classifier reads when an issue changes hands.

    These drive ``GroupAssignee.objects.assign()`` instead of writing rows directly,
    because it is the activity that call writes that the classifier reads.
    """

    def _truth(self, run: SeerAgentRun) -> tuple[int | None, int | None]:
        latest_assignment = (
            Activity.objects.filter(group=self.group, type=ActivityType.ASSIGNED.value)
            .order_by("-datetime", "-id")
            .first()
        )
        assert latest_assignment is not None
        record_ground_truth(self.group, ActivityType.ASSIGNED, latest_assignment)
        run.refresh_from_db()
        return (
            run.extras.get("actual_assignee_user_id"),
            run.extras.get("actual_assignee_team_id"),
        )

    def test_rule_team_handed_off_to_human_user_is_scoreable(self) -> None:
        run = self._run()
        team = self.create_team(organization=self.organization)
        human = self.create_user()
        self.create_member(user=human, organization=self.organization, teams=[team])
        GroupAssignee.objects.assign(self.group, team, extra=RULE_ORIGIN)
        GroupAssignee.objects.assign(self.group, human)

        assert self._truth(run) == (human.id, None)

    def test_human_user_reclaimed_by_rule_team_is_not_scoreable(self) -> None:
        # The reverse hand-off. Whoever assigned last is who we would grade against, so
        # a rule taking the issue back leaves nothing scoreable, even though a human
        # held it first.
        run = self._run()
        team = self.create_team(organization=self.organization)
        human = self.create_user()
        self.create_member(user=human, organization=self.organization, teams=[team])
        GroupAssignee.objects.assign(self.group, human)
        GroupAssignee.objects.assign(self.group, team, extra=RULE_ORIGIN)

        assert self._truth(run) == (None, None)

    def test_human_reassignment_after_unassign_is_scoreable(self) -> None:
        # Unassigning leaves the rule's ASSIGNED activity behind; the human's later one
        # still has to win.
        run = self._run()
        team = self.create_team(organization=self.organization)
        human = self.create_user()
        GroupAssignee.objects.assign(self.group, team, extra=RULE_ORIGIN)
        GroupAssignee.objects.deassign(self.group)
        GroupAssignee.objects.assign(self.group, human)

        assert self._truth(run) == (human.id, None)

    def test_same_timestamp_assignments_resolve_to_the_last_written(self) -> None:
        run = self._run()
        human = self.create_user()
        GroupAssignee.objects.create(group=self.group, project=self.group.project, user_id=human.id)
        stamped_at = timezone.now()
        for extra in (RULE_ORIGIN, {}):
            self.create_group_activity(
                group=self.group,
                type=ActivityType.ASSIGNED.value,
                data={"assignee": str(human.id), "assigneeType": "user", **extra},
                datetime=stamped_at,
            )

        assert self._truth(run) == (human.id, None)
