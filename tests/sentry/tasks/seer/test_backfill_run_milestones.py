from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.seer.milestones import (
    reconcile_milestones,
    reconcile_pull_requests_merged_milestone,
)
from sentry.seer.models.run import (
    SeerRun,
    SeerRunMilestone,
    SeerRunMilestoneType,
    SeerRunMirrorStatus,
)
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.tasks.seer.backfill_run_milestones import backfill_run_milestones_for_org
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


def _root_cause_state(run_id: int) -> SeerRunState:
    return SeerRunState(
        run_id=run_id,
        blocks=[
            MemoryBlock(
                id="block",
                message=Message(role="assistant", content="content"),
                timestamp="2023-07-10T00:00:00Z",
                artifacts=[
                    Artifact(
                        key="root_cause",
                        data={"one_line_description": "Root cause"},
                        reason="reason",
                    )
                ],
            )
        ],
        status="completed",
        updated_at="2023-07-10T00:00:00Z",
    )


def _empty_state(run_id: int) -> SeerRunState:
    return SeerRunState(
        run_id=run_id,
        blocks=[],
        status="completed",
        updated_at="2023-07-10T00:00:00Z",
    )


@freeze_time("2023-08-05T00:00:00Z")
class BackfillRunMilestonesTest(TestCase):
    def _create_run(
        self,
        *,
        organization: Organization | None = None,
        seer_run_state_id: int,
        last_triggered_at: datetime | None = None,
        source: str = "autofix",
        mirror_status: str = SeerRunMirrorStatus.LIVE,
    ) -> SeerRun:
        run = self.create_seer_run(
            organization=organization or self.organization,
            seer_run_state_id=seer_run_state_id,
            last_triggered_at=last_triggered_at or datetime(2023, 7, 10, tzinfo=UTC),
            mirror_status=mirror_status,
        )
        self.create_seer_agent_run(run, source=source)
        return run

    def _merged_pr(self, run: SeerRun, key: str) -> None:
        repository = self.create_repo(self.project, name="getsentry/sentry")
        pull_request = self.create_pull_request(
            repository_id=repository.id, organization_id=self.organization.id, key=key
        )
        pull_request.update(state=PullRequestLifecycleState.MERGED)
        self.create_seer_run_pull_request(run=run, pull_request=pull_request)

    def _milestone_rows(self, run: SeerRun) -> set[tuple[str, str]]:
        return {
            (milestone, repr(extras))
            for milestone, extras in SeerRunMilestone.objects.filter(seer_run=run).values_list(
                "milestone", "extras"
            )
        }

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_backfill_reconciles_to_final_truth(self, mock_fetch_run_status: MagicMock) -> None:
        # The backfill reconciles a run to the same rows a direct reconcile of its
        # state produces: it delegates to reconcile rather than reimplementing it.
        state = _root_cause_state(200)
        reference = self._create_run(seer_run_state_id=200)
        self._merged_pr(reference, key="10")
        reconcile_milestones(reference, state)
        reconcile_pull_requests_merged_milestone(reference)

        backfill_run = self._create_run(seer_run_state_id=201)
        self._merged_pr(backfill_run, key="20")
        mock_fetch_run_status.return_value = state

        backfill_run_milestones_for_org(self.organization.id, dry_run=False)

        assert self._milestone_rows(backfill_run) == self._milestone_rows(reference)
        assert {SeerRunMilestoneType.ROOT_CAUSE, SeerRunMilestoneType.PULL_REQUESTS_MERGED} <= {
            m for m, _ in self._milestone_rows(reference)
        }

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_dry_run_does_not_write(self, mock_fetch_run_status: MagicMock) -> None:
        run = self._create_run(seer_run_state_id=102)
        mock_fetch_run_status.return_value = _root_cause_state(102)

        backfill_run_milestones_for_org(self.organization.id)

        assert not SeerRunMilestone.objects.filter(seer_run=run).exists()

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_scopes_candidates(self, mock_fetch_run_status: MagicMock) -> None:
        eligible = self._create_run(seer_run_state_id=103)
        rca = self._create_run(seer_run_state_id=114, source="autofix_rca")
        other_organization = self.create_organization()
        self._create_run(organization=other_organization, seer_run_state_id=104)
        self._create_run(
            seer_run_state_id=105,
            last_triggered_at=datetime(2023, 7, 5, 23, 59, tzinfo=UTC),
        )
        self._create_run(
            seer_run_state_id=106,
            last_triggered_at=datetime(2023, 8, 5, tzinfo=UTC),
        )
        self._create_run(seer_run_state_id=107, source="chat")
        self._create_run(
            seer_run_state_id=108,
            mirror_status=SeerRunMirrorStatus.PENDING,
        )
        mock_fetch_run_status.return_value = _empty_state(103)

        backfill_run_milestones_for_org(self.organization.id)

        assert {call.args[0] for call in mock_fetch_run_status.call_args_list} == {
            eligible.seer_run_state_id,
            rca.seer_run_state_id,
        }

    @patch("sentry.tasks.seer.backfill_run_milestones.backfill_run_milestones_for_org.apply_async")
    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_self_chains_with_cursor(
        self, mock_fetch_run_status: MagicMock, mock_apply_async: MagicMock
    ) -> None:
        first = self._create_run(seer_run_state_id=109)
        self._create_run(seer_run_state_id=110)
        mock_fetch_run_status.return_value = _empty_state(109)

        backfill_run_milestones_for_org(
            self.organization.id,
            batch_size=1,
        )

        mock_apply_async.assert_called_once()
        assert mock_apply_async.call_args.kwargs["args"] == [self.organization.id]
        assert mock_apply_async.call_args.kwargs["kwargs"] == {
            "last_seer_run_id": first.id,
            "batch_size": 1,
            "dry_run": True,
            "start_at": "2023-07-06T00:00:00+00:00",
            "end_at": "2023-08-05T00:00:00+00:00",
        }

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_honors_explicit_window_over_now(self, mock_fetch_run_status: MagicMock) -> None:
        # A chained batch must scan the window pinned on the first call, not a
        # window recomputed from a later now() that has slid past edge runs.
        run = self._create_run(
            seer_run_state_id=116,
            last_triggered_at=datetime(2023, 6, 1, tzinfo=UTC),
        )
        mock_fetch_run_status.return_value = _empty_state(116)

        backfill_run_milestones_for_org(
            self.organization.id,
            start_at="2023-05-01T00:00:00+00:00",
            end_at="2023-06-15T00:00:00+00:00",
        )

        mock_fetch_run_status.assert_called_once()
        assert mock_fetch_run_status.call_args.args[0] == run.seer_run_state_id

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_missing_state_does_not_block_later_runs(
        self, mock_fetch_run_status: MagicMock
    ) -> None:
        missing = self._create_run(seer_run_state_id=111)
        backfilled = self._create_run(seer_run_state_id=112)
        mock_fetch_run_status.side_effect = [
            SeerApiError("missing", 404),
            _root_cause_state(112),
        ]

        backfill_run_milestones_for_org(
            self.organization.id,
            dry_run=False,
        )

        assert not SeerRunMilestone.objects.filter(seer_run=missing).exists()
        assert SeerRunMilestone.objects.filter(
            seer_run=backfilled,
            milestone=SeerRunMilestoneType.ROOT_CAUSE,
        ).exists()

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_invalid_state_is_skipped(self, mock_fetch_run_status: MagicMock) -> None:
        invalid = self._create_run(seer_run_state_id=117)
        backfilled = self._create_run(seer_run_state_id=118)
        mock_fetch_run_status.side_effect = [
            ValidationError([], SeerRunState),
            _root_cause_state(118),
        ]

        backfill_run_milestones_for_org(self.organization.id, dry_run=False)

        assert not SeerRunMilestone.objects.filter(seer_run=invalid).exists()
        assert SeerRunMilestone.objects.filter(
            seer_run=backfilled, milestone=SeerRunMilestoneType.ROOT_CAUSE
        ).exists()

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_fetch_error_skips_run_and_continues(self, mock_fetch_run_status: MagicMock) -> None:
        failed = self._create_run(seer_run_state_id=120)
        backfilled = self._create_run(seer_run_state_id=121)
        mock_fetch_run_status.side_effect = [
            SeerApiError("boom", 500),
            _root_cause_state(121),
        ]

        backfill_run_milestones_for_org(self.organization.id, dry_run=False)

        assert not SeerRunMilestone.objects.filter(seer_run=failed).exists()
        assert SeerRunMilestone.objects.filter(
            seer_run=backfilled, milestone=SeerRunMilestoneType.ROOT_CAUSE
        ).exists()

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_whole_batch_fetch_failure_raises(self, mock_fetch_run_status: MagicMock) -> None:
        self._create_run(seer_run_state_id=122)
        self._create_run(seer_run_state_id=123)
        mock_fetch_run_status.side_effect = SeerApiError("down", 503)

        with pytest.raises(SeerApiError):
            backfill_run_milestones_for_org(self.organization.id, dry_run=False)

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_writes_has_pull_request_when_pr_linked_but_state_lacks_it(
        self, mock_fetch_run_status: MagicMock
    ) -> None:
        # Coding-agent PRs are recorded live via record_has_pull_request and may be
        # absent from Seer state; a linked PR row is authoritative.
        run = self._create_run(seer_run_state_id=130)
        self._merged_pr(run, key="30")
        mock_fetch_run_status.return_value = _empty_state(130)

        backfill_run_milestones_for_org(self.organization.id, dry_run=False)

        assert SeerRunMilestone.objects.filter(
            seer_run=run, milestone=SeerRunMilestoneType.HAS_PULL_REQUEST
        ).exists()

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_killswitch_halts_before_any_work(self, mock_fetch_run_status: MagicMock) -> None:
        run = self._create_run(seer_run_state_id=119)

        with self.options({"seer.run_milestone_backfill.killswitch": True}):
            backfill_run_milestones_for_org(self.organization.id, dry_run=False)

        mock_fetch_run_status.assert_not_called()
        assert not SeerRunMilestone.objects.filter(seer_run=run).exists()

    def test_rejects_invalid_batch_size(self) -> None:
        for batch_size in (0, 101):
            with self.subTest(batch_size=batch_size):
                with pytest.raises(ValueError):
                    backfill_run_milestones_for_org(
                        self.organization.id,
                        batch_size=batch_size,
                    )
