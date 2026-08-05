from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState
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

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_backfills_milestones_and_extras(self, mock_fetch_run_status: MagicMock) -> None:
        run = self._create_run(seer_run_state_id=101)
        mock_fetch_run_status.return_value = _root_cause_state(101)

        backfill_run_milestones_for_org(
            self.organization.id,
            dry_run=False,
        )

        milestone = SeerRunMilestone.objects.get(
            seer_run=run, milestone=SeerRunMilestoneType.ROOT_CAUSE
        )
        assert milestone.extras == {"root_cause_artifact": {"one_line_description": "Root cause"}}

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_dry_run_does_not_write(self, mock_fetch_run_status: MagicMock) -> None:
        run = self._create_run(seer_run_state_id=102)
        mock_fetch_run_status.return_value = _root_cause_state(102)

        backfill_run_milestones_for_org(self.organization.id)

        assert not SeerRunMilestone.objects.filter(seer_run=run).exists()

    @patch("sentry.tasks.seer.backfill_run_milestones.fetch_run_status")
    def test_scopes_candidates(self, mock_fetch_run_status: MagicMock) -> None:
        eligible = self._create_run(seer_run_state_id=103)
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

        mock_fetch_run_status.assert_called_once()
        assert mock_fetch_run_status.call_args.args[0] == eligible.seer_run_state_id

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
        }

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
    def test_backfills_pull_requests_merged(self, mock_fetch_run_status: MagicMock) -> None:
        run = self._create_run(seer_run_state_id=113)
        repository = self.create_repo(self.project, name="getsentry/sentry")
        pull_request = self.create_pull_request(
            repository_id=repository.id,
            organization_id=self.organization.id,
            key="1",
        )
        pull_request.update(state=PullRequestLifecycleState.MERGED)
        self.create_seer_run_pull_request(run=run, pull_request=pull_request)
        mock_fetch_run_status.return_value = _empty_state(113)

        backfill_run_milestones_for_org(
            self.organization.id,
            dry_run=False,
        )

        assert SeerRunMilestone.objects.filter(
            seer_run=run,
            milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED,
        ).exists()

    def test_rejects_invalid_batch_size(self) -> None:
        for batch_size in (0, 101):
            with self.subTest(batch_size=batch_size):
                with pytest.raises(ValueError):
                    backfill_run_milestones_for_org(
                        self.organization.id,
                        batch_size=batch_size,
                    )
