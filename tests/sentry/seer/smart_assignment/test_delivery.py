from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
from sentry.seer.smart_assignment.delivery import deliver_smart_assignment_result
from sentry.seer.smart_assignment.models import SEER_FEATURE_ID, SmartAssignmentScore
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
    def test_records_top_pick_resolved_to_user(self, mock_metrics: MagicMock) -> None:
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        result = {
            "candidates": [
                {
                    "identifier": "alice",
                    "identifier_kind": "username",
                    "reason": "suspect commit",
                    "confidence": "high",
                },
                {
                    "identifier": "bob",
                    "identifier_kind": "username",
                    "reason": "code owner",
                    "confidence": "low",
                },
            ]
        }
        self._deliver(result)

        # Every candidate resolved (best-first) and cached on the run mirror: alice is
        # an org member; "bob" maps to no org user, so its rank is held with None. The
        # full verdict itself lives on the Seer run, not here.
        assert self._extras()["predicted_assignee_user_ids"] == [alice.id, None]
        self._assert_outcome(mock_metrics, "resolved")

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
        self._deliver(result)

        assert self._extras()["predicted_assignee_user_ids"] == [carol.id]
        self._assert_outcome(mock_metrics, "resolved")

    @patch(METRICS_PATH)
    def test_unresolvable_identifier_records_no_user(self, mock_metrics: MagicMock) -> None:
        result = {
            "candidates": [
                {
                    "identifier": "nobody-here",
                    "identifier_kind": "username",
                    "reason": "guess",
                    "confidence": "low",
                },
            ]
        }
        self._deliver(result)

        assert self._extras()["predicted_assignee_user_ids"] == [None]
        self._assert_outcome(mock_metrics, "unlinked")

    @patch(METRICS_PATH)
    def test_empty_candidates_is_abstain(self, mock_metrics: MagicMock) -> None:
        self._deliver({"candidates": []})
        assert self._extras()["predicted_assignee_user_ids"] == []
        self._assert_outcome(mock_metrics, "abstain")

    @patch(METRICS_PATH)
    def test_error_status_records_nothing(self, mock_metrics: MagicMock) -> None:
        self._deliver(None, status="error", error="boom")
        # No prediction recorded on error; the Seer run holds the failure.
        assert "predicted_assignee_user_ids" not in self._extras()
        self._assert_outcome(mock_metrics, "error")

    @patch("sentry.seer.smart_assignment.scoring.metrics")
    def test_scores_when_ground_truth_already_present(
        self, mock_scoring_metrics: MagicMock
    ) -> None:
        # Assignment landed before Seer finished: ground truth is already on the run
        # mirror, so delivering the prediction completes the pair and scores it.
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        self.mirror.extras = {**self.mirror.extras, "actual_assignee_user_id": alice.id}
        self.mirror.save(update_fields=["extras"])
        result = {
            "candidates": [
                {
                    "identifier": "alice",
                    "identifier_kind": "username",
                    "reason": "x",
                    "confidence": "high",
                }
            ]
        }
        self._deliver(result)

        mock_scoring_metrics.incr.assert_called_once_with(
            "smart_assignment.scored",
            tags={
                "result": SmartAssignmentScore.EXACT,
                "hit_rank": 1,
                "trigger": ActivityType.SEER_RCA_STARTED.name,
            },
        )

    @patch(METRICS_PATH)
    def test_prediction_lands_on_delivered_run_not_latest_mirror(
        self, mock_metrics: MagicMock
    ) -> None:
        # A race left a second, newer smart-assignment mirror on the same group. Delivery
        # resolves the exact run from the delivered uuid, so the prediction must land on
        # that row -- not the latest one by date_added.
        newer_seer_run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.FEATURE_RUN,
            last_triggered_at=timezone.now(),
        )
        newer_mirror = SeerAgentRun.objects.create(
            run=newer_seer_run,
            source=SEER_FEATURE_ID,
            group=self.group,
            extras={"trigger": ActivityType.SEER_RCA_STARTED.name},
        )
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        self._deliver({"candidates": [{"identifier": "alice", "identifier_kind": "username"}]})

        assert self._extras()["predicted_assignee_user_ids"] == [alice.id]
        newer_mirror.refresh_from_db()
        assert "predicted_assignee_user_ids" not in (newer_mirror.extras or {})

    @patch(METRICS_PATH)
    def test_prediction_lands_when_seer_run_and_mirror_ids_diverge(
        self, mock_metrics: MagicMock
    ) -> None:
        # The completion activity carries the SeerRun PK as `run_id`, which equals the
        # SeerAgentRun row id only when their sequences happen to line up. Create extra
        # SeerRuns with no mirror so the two ids diverge, then assert the resolved picks
        # still land on the right mirror (the completion handler must match on the run FK).
        for _ in range(3):
            SeerRun.objects.create(
                organization=self.organization,
                type=SeerRunType.FEATURE_RUN,
                last_triggered_at=timezone.now(),
            )
        seer_run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.FEATURE_RUN,
            last_triggered_at=timezone.now(),
        )
        mirror = SeerAgentRun.objects.create(
            run=seer_run,
            source=SEER_FEATURE_ID,
            group=self.group,
            extras={"trigger": ActivityType.SEER_RCA_STARTED.name},
        )
        assert seer_run.id != mirror.id
        alice = self.create_user(username="alice")
        self.create_member(user=alice, organization=self.organization)
        deliver_smart_assignment_result(
            self.organization.id,
            seer_run.uuid,
            "completed",
            {"candidates": [{"identifier": "alice", "identifier_kind": "username"}]},
            None,
        )

        mirror.refresh_from_db()
        assert mirror.extras["predicted_assignee_user_ids"] == [alice.id]

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
