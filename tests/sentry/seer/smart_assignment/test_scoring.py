from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
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
        )

    @patch(METRICS_PATH)
    def test_exact_when_prediction_matches_user(self, mock_metrics: MagicMock) -> None:
        user = self.create_user()
        run = self._run(actual_assignee_user_id=user.id)
        record_prediction(run, [user.id])

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
        record_prediction(run, [alice.id])

        self._assert_result(mock_metrics, SmartAssignmentScore.TEAM)

    @patch(METRICS_PATH)
    def test_team_when_predicted_shares_team_with_actual_user(
        self, mock_metrics: MagicMock
    ) -> None:
        team = self.create_team(organization=self.organization)
        alice = self.create_user()
        bob = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team])
        self.create_member(user=bob, organization=self.organization, teams=[team])
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id])

        self._assert_result(mock_metrics, SmartAssignmentScore.TEAM)

    @patch(METRICS_PATH)
    def test_miss_when_no_team_overlap(self, mock_metrics: MagicMock) -> None:
        team_a = self.create_team(organization=self.organization)
        team_b = self.create_team(organization=self.organization)
        alice = self.create_user()
        bob = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team_a])
        self.create_member(user=bob, organization=self.organization, teams=[team_b])
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id])

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS)

    @patch(METRICS_PATH)
    def test_hit_rank_when_actual_is_lower_candidate(self, mock_metrics: MagicMock) -> None:
        # Top pick is wrong (and shares no team with the actual assignee, so it's a
        # miss), but the actual assignee is the second-ranked candidate -- still a hit.
        alice = self.create_user()
        bob = self.create_user()
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id, bob.id])

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=2)

    @patch(METRICS_PATH)
    def test_no_hit_rank_when_actual_absent_from_candidates(self, mock_metrics: MagicMock) -> None:
        alice = self.create_user()
        bob = self.create_user()
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [alice.id])

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=0)

    @patch(METRICS_PATH)
    def test_unresolved_top_pick_is_miss_but_lower_candidate_still_hits(
        self, mock_metrics: MagicMock
    ) -> None:
        # Top pick couldn't be mapped to an org user (None), so the coarse outcome is a
        # miss, but the actual assignee is the rank-2 candidate -- still a hit.
        bob = self.create_user()
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [None, bob.id])

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=2)

    @patch(METRICS_PATH)
    def test_unresolved_top_pick_alone_is_miss(self, mock_metrics: MagicMock) -> None:
        bob = self.create_user()
        run = self._run(actual_assignee_user_id=bob.id)
        record_prediction(run, [None])

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=0)

    @patch(METRICS_PATH)
    def test_unresolved_top_pick_with_team_truth_is_miss(self, mock_metrics: MagicMock) -> None:
        # Team-only ground truth with an unresolved top pick must not read as an EXACT
        # match on the None == None comparison.
        team = self.create_team(organization=self.organization)
        run = self._run(actual_assignee_team_id=team.id)
        record_prediction(run, [None])

        self._assert_result(mock_metrics, SmartAssignmentScore.MISS, hit_rank=0)

    @patch(METRICS_PATH)
    def test_noop_without_both_sides(self, mock_metrics: MagicMock) -> None:
        # Prediction but no ground truth yet.
        run = self._run()
        record_prediction(run, [7])
        # Ground truth but no (resolvable) prediction (separate group).
        other = self.create_group()
        other_run = self._run(group=other, actual_assignee_user_id=9)
        record_prediction(other_run, [])
        mock_metrics.incr.assert_not_called()

    @patch(METRICS_PATH)
    def test_scores_only_once(self, mock_metrics: MagicMock) -> None:
        user = self.create_user()
        run = self._run(actual_assignee_user_id=user.id)
        record_prediction(run, [user.id])
        record_prediction(run, [user.id])
        assert mock_metrics.incr.call_count == 1


class RecordGroundTruthTest(ScoringTestBase):
    def _resolved_activity(self, user_id: int | None = None) -> Activity:
        return self.create_group_activity(
            group=self.group, type=ActivityType.SET_RESOLVED.value, user_id=user_id
        )

    def test_noop_without_run(self) -> None:
        record_ground_truth(
            self.group, ActivityType.SET_RESOLVED, self._resolved_activity(self.user.id)
        )
        assert not SeerAgentRun.objects.filter(
            group_id=self.group.id, source=SEER_FEATURE_ID
        ).exists()

    def test_records_assignee_user(self) -> None:
        run = self._run()
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        record_ground_truth(self.group, ActivityType.ASSIGNED)

        run.refresh_from_db()
        assert run.extras["actual_assignee_user_id"] == assignee.id
        assert run.extras["ground_truth_source"] == ActivityType.ASSIGNED.name

    def test_resolution_keeps_team_truth_over_resolver(self) -> None:
        team = self.create_team(organization=self.organization)
        run = self._run(actual_assignee_team_id=team.id)
        resolver = self.create_user()
        record_ground_truth(
            self.group, ActivityType.SET_RESOLVED, self._resolved_activity(resolver.id)
        )

        run.refresh_from_db()
        # A prior team assignee is enough truth; the resolver isn't recorded.
        assert "actual_assignee_user_id" not in run.extras
        assert run.extras["actual_assignee_team_id"] == team.id

    def test_automatic_resolution_is_noop(self) -> None:
        run = self._run()
        record_ground_truth(self.group, ActivityType.SET_RESOLVED, self._resolved_activity(None))

        run.refresh_from_db()
        assert "actual_assignee_user_id" not in run.extras
        assert "ground_truth_source" not in run.extras

    def test_seer_start_is_noop(self) -> None:
        run = self._run()
        record_ground_truth(self.group, ActivityType.SEER_RCA_STARTED)

        run.refresh_from_db()
        assert "ground_truth_source" not in run.extras

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
        record_ground_truth(self.group, ActivityType.ASSIGNED)

        mock_metrics.incr.assert_any_call(
            "smart_assignment.scored",
            tags={"result": SmartAssignmentScore.EXACT, "hit_rank": 1, "trigger": STARTED.name},
        )

    def test_resolution_does_not_overwrite_existing_assignee(self) -> None:
        assignee = self.create_user()
        run = self._run(
            actual_assignee_user_id=assignee.id,
            ground_truth_source=ActivityType.ASSIGNED.name,
        )
        resolver = self.create_user()
        record_ground_truth(
            self.group, ActivityType.SET_RESOLVED, self._resolved_activity(resolver.id)
        )

        run.refresh_from_db()
        assert run.extras["actual_assignee_user_id"] == assignee.id
        assert run.extras["ground_truth_source"] == ActivityType.ASSIGNED.name
