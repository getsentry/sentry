from __future__ import annotations

from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.investigations.models import (
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.tasks.seer.investigation import dispatch_investigation_execution
from sentry.testutils.cases import TestCase


class InvestigationAutoRunTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
        )
        self.create_investigation_project(investigation=self.investigation, project=self.project)
        self.root = self.create_investigation_block(
            investigation=self.investigation,
            position=0,
            kind=InvestigationBlockKind.QUERY,
            prompt="Chart the breach",
            config={"autoRun": True},
        )
        self.dependent = self.create_investigation_block(
            investigation=self.investigation,
            position=1,
            kind=InvestigationBlockKind.TEXT,
            prompt="Explain the chart",
            config={"autoRun": True},
        )
        self.create_investigation_block_dependency(block=self.dependent, depends_on=self.root)

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_execution")
    def test_dispatches_in_dependency_order(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        self.root.refresh_from_db()
        self.dependent.refresh_from_db()
        assert self.root.current_execution is not None
        assert self.root.current_execution.status == InvestigationBlockExecutionStatus.PENDING
        assert self.dependent.current_execution is None
        dispatch.delay.assert_called_once_with(self.root.current_execution.id)

        self.root.current_execution.update(
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={
                "schemaVersion": 1,
                "tableMarkdown": "| count |\n| --- |\n| 1 |",
                "chart": None,
                "preferredView": "table",
                "isEmpty": False,
                "chartUnavailableReason": None,
                "queryLinks": [],
            },
        )
        self.root.result_execution = self.root.current_execution
        self.root.save(update_fields=["result_execution", "date_updated"])
        self.root.refresh_from_db()
        assert self.root.stale_at is None
        assert self.root.result_execution is not None
        assert self.root.result_execution.status == InvestigationBlockExecutionStatus.COMPLETED
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        dependent = InvestigationBlock.objects.get(id=self.dependent.id)
        assert dependent.current_execution is not None
        assert dependent.current_execution.status == InvestigationBlockExecutionStatus.PENDING
        dispatch.delay.assert_called_once_with(dependent.current_execution.id)

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_execution")
    def test_redispatches_an_existing_pending_execution(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution_id = self.root.current_execution_id
        assert execution_id is not None
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        self.root.refresh_from_db()
        assert self.root.current_execution_id == execution_id
        assert InvestigationBlockExecution.objects.filter(block=self.root).count() == 1
        dispatch.delay.assert_called_once_with(execution_id)

    @mock.patch("sentry.tasks.seer.investigation.start_execution_run")
    def test_duplicate_dispatches_only_start_one_run(self, start_execution_run: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution_id = self.root.current_execution_id
        assert execution_id is not None

        dispatch_investigation_execution(execution_id)
        dispatch_investigation_execution(execution_id)

        start_execution_run.assert_called_once()

    @mock.patch("sentry.tasks.seer.investigation.start_execution_run")
    def test_stale_dispatch_claim_can_be_reclaimed(self, start_execution_run: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution = self.root.current_execution
        assert execution is not None

        dispatch_investigation_execution(execution.id)
        execution.update(started_at=timezone.now() - timedelta(minutes=6))
        dispatch_investigation_execution(execution.id)

        assert start_execution_run.call_count == 2

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_execution")
    def test_redispatches_a_stale_dispatch_claim(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution = self.root.current_execution
        assert execution is not None
        execution.update(
            status=InvestigationBlockExecutionStatus.RUNNING,
            started_at=timezone.now() - timedelta(minutes=6),
        )
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        dispatch.delay.assert_called_once_with(execution.id)
