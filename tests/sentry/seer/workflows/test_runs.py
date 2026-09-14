from functools import partial
from unittest.mock import Mock, patch

import pytest

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.seer.models.workflow import SeerWorkflowRun, SeerWorkflowStrategy
from sentry.seer.workflows.runs import (
    create_workflow_run,
    deliver_workflow_result,
    finish_workflow_run,
)
from sentry.seer.workflows.schemas import WorkflowResult
from sentry.testutils.cases import TestCase


class WorkflowRunTest(TestCase):
    def test_creation_links_execution_and_defers_dispatch(self) -> None:
        with patch("sentry.receivers.outbox.cell.make_feature_run_request") as dispatch:
            run = self.create_run()
        dispatch.assert_not_called()
        workflow = run.workflow_execution.run
        assert workflow.organization_id == self.organization.id
        assert workflow.workflow_config is not None
        assert workflow.workflow_config.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE
        assert run.agent.extras == {
            "status": "running",
            "date_completed": None,
            "error": None,
            "summary": None,
        }
        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.id
        )
        assert outbox.payload is not None
        assert outbox.payload["body"]["feature_id"] == "test_workflow"
        assert outbox.payload["viewer_context"]["user_id"] == self.user.id

    def test_creation_rolls_back_if_execution_creation_fails(self) -> None:
        with (
            patch(
                "sentry.seer.workflows.runs.SeerWorkflowRunExecution.objects.create",
                side_effect=RuntimeError("Cannot create execution"),
            ),
            pytest.raises(RuntimeError, match="Cannot create execution"),
        ):
            self.create_run()
        assert not SeerWorkflowRun.objects.filter(organization=self.organization).exists()
        assert not SeerRun.objects.filter(organization=self.organization).exists()
        assert not SeerAgentRun.objects.filter(run__organization=self.organization).exists()
        assert not CellOutbox.objects.filter(category=OutboxCategory.SEER_RUN_CREATE).exists()

    def test_delivery_stores_feature_results_and_ignores_duplicates(self) -> None:
        run = self.create_run()
        parser = Mock(return_value=WorkflowResult(extras={"summary": "Finished"}, status="partial"))
        deliver = partial(
            deliver_workflow_result,
            feature_id="test_workflow",
            organization_id=self.organization.id,
            run_uuid=run.uuid,
            parse_result=parser,
        )
        deliver(status="completed", result={"raw": "output"}, error=None)
        run.agent.refresh_from_db()
        assert run.agent.extras["status"] == "partial"
        assert run.agent.extras["summary"] == "Finished"
        assert run.agent.extras["date_completed"] is not None
        parser.assert_called_once_with({"raw": "output"}, run.agent)
        completed_extras = run.agent.extras.copy()

        deliver(status="error", result=None, error="Late failure")
        finish_workflow_run(
            run.id,
            organization_id=self.organization.id,
            feature_id="test_workflow",
            error="Late failure",
        )
        run.agent.refresh_from_db()
        assert run.agent.extras == completed_extras

    def test_delivery_and_finish_are_scoped_to_organization_and_feature(self) -> None:
        run = self.create_run()
        parser = Mock()
        deliver = partial(
            deliver_workflow_result,
            run_uuid=run.uuid,
            status="completed",
            result={},
            error=None,
            parse_result=parser,
        )
        other_org = self.create_organization()
        deliver(organization_id=other_org.id, feature_id="test_workflow")
        deliver(organization_id=self.organization.id, feature_id="another_workflow")
        finish_workflow_run(
            run.id, organization_id=other_org.id, feature_id="test_workflow", error="Wrong org"
        )
        finish_workflow_run(
            run.id,
            organization_id=self.organization.id,
            feature_id="another_workflow",
            error="Wrong workflow",
        )
        parser.assert_not_called()
        run.agent.refresh_from_db()
        assert run.agent.extras["status"] == "running"

    def test_failed_delivery_records_safe_error_without_parsing(self) -> None:
        run = self.create_run()
        parser = Mock()
        deliver_workflow_result(
            feature_id="test_workflow",
            organization_id=self.organization.id,
            run_uuid=run.uuid,
            status="error",
            result=None,
            error="Internal error details",
            parse_result=parser,
        )
        parser.assert_not_called()
        run.agent.refresh_from_db()
        assert run.agent.extras["status"] == "failed"
        assert run.agent.extras["date_completed"] is not None
        assert run.agent.extras["error"] == "Seer could not complete this workflow."

    def create_run(self) -> SeerRun:
        with self.feature("organizations:gen-ai-features"):
            workflow = create_workflow_run(
                SeerAgentClient(self.organization, self.user),
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE,
                feature_id="test_workflow",
                title="Test workflow",
                payload={},
                extras={"summary": None},
            )
        run = workflow.executions.get().seer_run
        assert run is not None
        return run
