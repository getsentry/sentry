from unittest.mock import MagicMock, patch

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.seer.models.smart_assignment import (
    SeerSmartAssignmentResult,
    SmartAssignmentStatus,
    SmartAssignmentTrigger,
)
from sentry.seer.smart_assignment.scoring import (
    AUTO_ASSIGN_SOURCE,
    record_ground_truth,
    score_prediction,
)
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

METRICS_PATH = "sentry.seer.smart_assignment.scoring.metrics"


class ScorePredictionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def _row(self, group: Group | None = None, **kwargs: object) -> SeerSmartAssignmentResult:
        return SeerSmartAssignmentResult.objects.create(
            organization=self.organization,
            group=group or self.group,
            trigger=SmartAssignmentTrigger.ASSIGNMENT,
            status=SmartAssignmentStatus.COMPLETED,
            **kwargs,
        )

    def _assert_result(self, mock_metrics: MagicMock, expected: str) -> None:
        mock_metrics.incr.assert_called_once_with(
            "smart_assignment.scored",
            tags={"result": expected, "trigger": SmartAssignmentTrigger.ASSIGNMENT},
        )

    @patch(METRICS_PATH)
    def test_exact_when_prediction_matches_user(self, mock_metrics: MagicMock) -> None:
        user = self.create_user()
        row = self._row(predicted_assignee_user_id=user.id, actual_assignee_user_id=user.id)
        score_prediction(row)

        self._assert_result(mock_metrics, "exact")
        row.refresh_from_db()
        assert row.score == "exact"

    @patch(METRICS_PATH)
    def test_team_when_predicted_user_on_assigned_team(self, mock_metrics: MagicMock) -> None:
        team = self.create_team(organization=self.organization)
        alice = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team])
        row = self._row(predicted_assignee_user_id=alice.id, actual_assignee_team_id=team.id)
        score_prediction(row)

        self._assert_result(mock_metrics, "team")

    @patch(METRICS_PATH)
    def test_team_when_predicted_shares_team_with_actual_user(
        self, mock_metrics: MagicMock
    ) -> None:
        team = self.create_team(organization=self.organization)
        alice = self.create_user()
        bob = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team])
        self.create_member(user=bob, organization=self.organization, teams=[team])
        row = self._row(predicted_assignee_user_id=alice.id, actual_assignee_user_id=bob.id)
        score_prediction(row)

        self._assert_result(mock_metrics, "team")

    @patch(METRICS_PATH)
    def test_miss_when_no_team_overlap(self, mock_metrics: MagicMock) -> None:
        team_a = self.create_team(organization=self.organization)
        team_b = self.create_team(organization=self.organization)
        alice = self.create_user()
        bob = self.create_user()
        self.create_member(user=alice, organization=self.organization, teams=[team_a])
        self.create_member(user=bob, organization=self.organization, teams=[team_b])
        row = self._row(predicted_assignee_user_id=alice.id, actual_assignee_user_id=bob.id)
        score_prediction(row)

        self._assert_result(mock_metrics, "miss")

    @patch(METRICS_PATH)
    def test_noop_without_both_sides(self, mock_metrics: MagicMock) -> None:
        # Prediction but no ground truth yet.
        score_prediction(self._row(predicted_assignee_user_id=7))
        # Ground truth but no (resolvable) prediction (separate group -- one row per group).
        score_prediction(self._row(group=self.create_group(), actual_assignee_user_id=9))
        mock_metrics.incr.assert_not_called()

    @patch(METRICS_PATH)
    def test_scores_only_once(self, mock_metrics: MagicMock) -> None:
        user = self.create_user()
        row = self._row(predicted_assignee_user_id=user.id, actual_assignee_user_id=user.id)
        score_prediction(row)
        score_prediction(row)
        assert mock_metrics.incr.call_count == 1


class RecordGroundTruthTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def _row(self) -> SeerSmartAssignmentResult:
        return SeerSmartAssignmentResult.objects.create(
            organization=self.organization,
            group=self.group,
            trigger=SmartAssignmentTrigger.PR_CREATED,
            status=SmartAssignmentStatus.PENDING,
        )

    def _resolved_activity(self, user_id: int | None = None) -> Activity:
        return self.create_group_activity(
            group=self.group, type=ActivityType.SET_RESOLVED.value, user_id=user_id
        )

    def test_noop_without_row(self) -> None:
        record_ground_truth(
            self.group, SmartAssignmentTrigger.RESOLUTION, self._resolved_activity(self.user.id)
        )
        assert not SeerSmartAssignmentResult.objects.filter(group=self.group).exists()

    def test_records_assignee_user(self) -> None:
        row = self._row()
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        record_ground_truth(self.group, SmartAssignmentTrigger.ASSIGNMENT)

        row.refresh_from_db()
        assert row.actual_assignee_user_id == assignee.id
        assert row.ground_truth_source == SmartAssignmentTrigger.ASSIGNMENT

    def test_resolution_keeps_existing_team_and_adds_resolver(self) -> None:
        team = self.create_team(organization=self.organization)
        row = self._row()
        row.update(actual_assignee_team=team)
        resolver = self.create_user()
        record_ground_truth(
            self.group, SmartAssignmentTrigger.RESOLUTION, self._resolved_activity(resolver.id)
        )

        row.refresh_from_db()
        assert row.actual_assignee_user_id == resolver.id
        # A user-driven resolution shouldn't wipe a prior team assignee.
        assert row.actual_assignee_team_id == team.id

    def test_automatic_resolution_is_noop(self) -> None:
        row = self._row()
        record_ground_truth(
            self.group, SmartAssignmentTrigger.RESOLUTION, self._resolved_activity(None)
        )

        row.refresh_from_db()
        assert row.actual_assignee_user_id is None
        assert row.ground_truth_source is None

    def test_pr_created_is_noop(self) -> None:
        row = self._row()
        record_ground_truth(self.group, SmartAssignmentTrigger.PR_CREATED)

        row.refresh_from_db()
        assert row.ground_truth_source is None

    def test_our_auto_assignment_is_not_recorded(self) -> None:
        row = self._row()
        assignee = self.create_user()
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={
                "assignee": str(assignee.id),
                "assigneeType": "user",
                "source": AUTO_ASSIGN_SOURCE,
            },
        )
        record_ground_truth(self.group, SmartAssignmentTrigger.ASSIGNMENT, activity)

        row.refresh_from_db()
        assert row.actual_assignee_user_id is None
        assert row.ground_truth_source is None

    @patch(METRICS_PATH)
    def test_records_ground_truth_scores_existing_prediction(self, mock_metrics: MagicMock) -> None:
        # Prediction already delivered; recording the matching assignment as ground
        # truth should complete the pair and score it exact.
        assignee = self.create_user()
        row = self._row()
        row.update(predicted_assignee_user_id=assignee.id)
        GroupAssignee.objects.create(
            group=self.group, project=self.group.project, user_id=assignee.id
        )
        record_ground_truth(self.group, SmartAssignmentTrigger.ASSIGNMENT)

        mock_metrics.incr.assert_any_call(
            "smart_assignment.scored",
            tags={"result": "exact", "trigger": SmartAssignmentTrigger.PR_CREATED},
        )

    def test_resolution_does_not_overwrite_existing_assignee(self) -> None:
        assignee = self.create_user()
        row = self._row()
        row.update(
            actual_assignee_user_id=assignee.id,
            ground_truth_source=SmartAssignmentTrigger.ASSIGNMENT,
        )
        resolver = self.create_user()
        record_ground_truth(
            self.group, SmartAssignmentTrigger.RESOLUTION, self._resolved_activity(resolver.id)
        )

        row.refresh_from_db()
        assert row.actual_assignee_user_id == assignee.id
        assert row.ground_truth_source == SmartAssignmentTrigger.ASSIGNMENT
