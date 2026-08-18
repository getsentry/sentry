from __future__ import annotations

from unittest import mock

from sentry.investigations.models import (
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
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
        dispatch.assert_called_once_with(self.root.current_execution.id)

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
        dispatch.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        self.dependent.refresh_from_db()
        assert self.dependent.current_execution is not None
        assert self.dependent.current_execution.status == InvestigationBlockExecutionStatus.PENDING
        dispatch.assert_called_once_with(self.dependent.current_execution.id)

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
        dispatch.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        self.root.refresh_from_db()
        assert self.root.current_execution_id == execution_id
        assert InvestigationBlockExecution.objects.filter(block=self.root).count() == 1
        dispatch.assert_called_once_with(execution_id)
