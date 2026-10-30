from __future__ import annotations

from sentry.investigations.models import InvestigationOrchestrationStatus
from sentry.notebooks.models import Notebook
from sentry.seer.models.workflow import (
    SeerWorkflowExecutionStatus,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer_workflow_outputs.tasks import finish_investigation_executions
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class FinishInvestigationExecutionsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        self.workflow_run = Factories.create_seer_workflow_run(
            self.organization, workflow_config=config, status=SeerWorkflowRunStatus.RUNNING
        )
        self.execution = Factories.create_seer_workflow_run_execution(
            self.workflow_run, status=SeerWorkflowExecutionStatus.RUNNING
        )

    def link_investigation(self, status: InvestigationOrchestrationStatus) -> Notebook:
        notebook = self.create_notebook(self.organization, title="Example error spike")
        Factories.create_investigation_orchestration_run(notebook, status=status)
        Factories.create_seer_workflow_output_link(self.execution, notebook=notebook)
        return notebook

    def test_completed_investigation_completes_the_run(self) -> None:
        notebook = self.link_investigation(InvestigationOrchestrationStatus.COMPLETED)

        finish_investigation_executions(investigation_id=notebook.id)

        self.execution.refresh_from_db()
        self.workflow_run.refresh_from_db()
        assert self.execution.status == SeerWorkflowExecutionStatus.COMPLETE
        assert self.execution.extras == {"error": None}
        assert self.workflow_run.status == SeerWorkflowRunStatus.COMPLETE

    def test_failed_investigation_fails_the_run(self) -> None:
        notebook = self.link_investigation(InvestigationOrchestrationStatus.FAILED)

        finish_investigation_executions(investigation_id=notebook.id)

        self.execution.refresh_from_db()
        self.workflow_run.refresh_from_db()
        assert self.execution.status == SeerWorkflowExecutionStatus.FAILED
        assert self.execution.extras == {
            "error": {
                "code": "investigation_failed",
                "message": "The investigation did not finish.",
            }
        }
        assert self.workflow_run.status == SeerWorkflowRunStatus.FAILED

    def test_cancelled_investigation_fails_the_run(self) -> None:
        notebook = self.link_investigation(InvestigationOrchestrationStatus.CANCELLED)

        finish_investigation_executions(investigation_id=notebook.id)

        self.execution.refresh_from_db()
        assert self.execution.status == SeerWorkflowExecutionStatus.FAILED
        assert self.execution.extras["error"]["code"] == "investigation_cancelled"

    def test_unfinished_investigation_keeps_the_run_running(self) -> None:
        notebook = self.link_investigation(InvestigationOrchestrationStatus.PROCESSING)

        finish_investigation_executions(investigation_id=notebook.id)

        self.execution.refresh_from_db()
        self.workflow_run.refresh_from_db()
        assert self.execution.status == SeerWorkflowExecutionStatus.RUNNING
        assert self.workflow_run.status == SeerWorkflowRunStatus.RUNNING

    def test_execution_waits_for_every_linked_investigation(self) -> None:
        finished = self.link_investigation(InvestigationOrchestrationStatus.COMPLETED)
        pending = self.link_investigation(InvestigationOrchestrationStatus.PROCESSING)

        finish_investigation_executions(investigation_id=finished.id)
        self.execution.refresh_from_db()
        assert self.execution.status == SeerWorkflowExecutionStatus.RUNNING

        pending.orchestration_run.update(status=InvestigationOrchestrationStatus.COMPLETED)
        finish_investigation_executions(investigation_id=pending.id)
        self.execution.refresh_from_db()
        assert self.execution.status == SeerWorkflowExecutionStatus.COMPLETE

    def test_finished_executions_are_left_alone(self) -> None:
        notebook = self.link_investigation(InvestigationOrchestrationStatus.FAILED)
        self.execution.update(status=SeerWorkflowExecutionStatus.COMPLETE)

        finish_investigation_executions(investigation_id=notebook.id)

        self.execution.refresh_from_db()
        assert self.execution.status == SeerWorkflowExecutionStatus.COMPLETE
