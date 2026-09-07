from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
)
from sentry.seer.models.run import SeerRunType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


def query_result() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "tableMarkdown": "| Query | Errors |\n| --- | ---: |\n| is:unresolved | 12 |",
        "isEmpty": False,
        "queryLinks": [],
    }


@with_feature(FEATURE)
class InvestigationQueryExecutionEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Query execution",
        )
        self.create_investigation_project(investigation=self.investigation, project=self.project)
        self.block = self.create_investigation_block(
            investigation=self.investigation,
            kind="query",
            prompt="Show unresolved errors over the last day",
            display={"type": "table"},
        )
        self.url = reverse(
            "sentry-api-0-organization-investigation-block-executions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "block_id": self.block.id,
            },
        )

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_executions.SeerAgentClient"
    )
    def test_starts_and_persists_an_immutable_execution(self, mock_client: MagicMock) -> None:
        self.investigation.filters = {
            "datetime": {"period": "24h"},
            "environments": ["production"],
            "interval": "1h",
            "releases": ["backend@1.2.3"],
        }
        self.investigation.save(update_fields=["filters"])
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args: Any, **kwargs: Any) -> Any:
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.block.version,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        execution = InvestigationBlockExecution.objects.get(id=response.data["id"])
        assert execution.status == InvestigationBlockExecutionStatus.RUNNING
        assert execution.seer_run == run
        assert execution.input_snapshot["prompt"] == self.block.prompt
        assert execution.input_snapshot["projectIds"] == [self.project.id]
        self.block.refresh_from_db()
        assert self.block.current_execution == execution
        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert '"projectSlugs":["' + self.project.slug + '"]' in prompt
        assert '"environments":["production"]' in prompt
        assert '"releases":["backend@1.2.3"]' in prompt
        assert mock_client.return_value.start_run.call_args.kwargs["record_in_history"] is False

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_executions.SeerAgentClient"
    )
    def test_retry_while_running_returns_the_same_execution(self, mock_client: MagicMock) -> None:
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args: Any, **kwargs: Any) -> Any:
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        body = {
            "investigationVersion": self.investigation.version,
            "requestId": str(uuid4()),
            "version": self.block.version,
        }
        first = self.client.post(self.url, data=body, format="json")
        second = self.client.post(self.url, data=body, format="json")

        assert first.status_code == second.status_code == 202
        assert first.data["id"] == second.data["id"]
        assert mock_client.return_value.start_run.call_count == 1

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_executions.SeerAgentClient"
    )
    def test_new_run_request_supersedes_an_identical_running_execution(
        self, mock_client: MagicMock
    ) -> None:
        runs = [
            self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN),
            self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN),
        ]

        def start_run(*args: Any, **kwargs: Any) -> Any:
            run = runs.pop(0)
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        body = {
            "investigationVersion": self.investigation.version,
            "version": self.block.version,
        }
        first = self.client.post(self.url, data={**body, "requestId": str(uuid4())}, format="json")
        second = self.client.post(self.url, data={**body, "requestId": str(uuid4())}, format="json")

        assert first.status_code == second.status_code == 202
        assert first.data["id"] != second.data["id"]
        assert mock_client.return_value.start_run.call_count == 2
        self.block.refresh_from_db()
        assert str(self.block.current_execution.id) == second.data["id"]

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_executions.SeerAgentClient"
    )
    def test_hidden_template_hint_is_forwarded_without_a_request_dataset(
        self, mock_client: MagicMock
    ) -> None:
        self.block.config = {"datasetHint": "metrics"}
        self.block.save(update_fields=["config"])
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args: Any, **kwargs: Any) -> Any:
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.block.version,
            },
            format="json",
        )

        assert response.status_code == 202
        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert '"datasetHint":"metrics"' in prompt

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_executions.SeerAgentClient"
    )
    def test_sends_actual_upstream_block_content_as_query_context(
        self, mock_client: MagicMock
    ) -> None:
        context_block = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            title="Investigation goal",
            content="Focus on the checkout regression.",
        )
        self.create_investigation_block_dependency(block=self.block, depends_on=context_block)
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args: Any, **kwargs: Any) -> Any:
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.block.version,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert "Focus on the checkout regression." in prompt

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_executions.SeerAgentClient"
    )
    def test_dispatch_failure_cancels_other_active_cells(self, mock_client: MagicMock) -> None:
        sibling_block = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            prompt="Explain the spike",
            position=1,
        )
        sibling_execution = self.create_investigation_block_execution(
            block=sibling_block,
            executor="text_generation",
            status=InvestigationBlockExecutionStatus.RUNNING,
            block_version=sibling_block.version,
        )
        sibling_block.current_execution = sibling_execution
        sibling_block.save(update_fields=["current_execution"])
        mock_client.return_value.start_run.side_effect = RuntimeError("Seer unavailable")

        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.block.version,
            },
            format="json",
        )

        assert response.status_code == 500
        failed_execution = InvestigationBlockExecution.objects.get(block=self.block)
        sibling_execution.refresh_from_db()
        assert failed_execution.status == InvestigationBlockExecutionStatus.FAILED
        assert sibling_execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert sibling_execution.error == {
            "code": "investigation_execution_failed",
            "message": "Cancelled because another cell in this investigation failed.",
        }


@with_feature(FEATURE)
class InvestigationTextExecutionEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Text generation",
        )
        self.create_investigation_project(investigation=self.investigation, project=self.project)
        self.context_block = self.create_investigation_block(
            investigation=self.investigation,
            kind="query",
            title="Error trend",
            prompt="Show errors over time",
        )
        context_execution = self.create_investigation_block_execution(
            block=self.context_block,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.COMPLETED,
            block_version=self.context_block.version,
            input_snapshot={"projectIds": [self.project.id]},
            input_fingerprint="c" * 64,
            result=query_result(),
        )
        context_execution.data_projects.add(self.project)
        self.context_block.current_execution = context_execution
        self.context_block.result_execution = context_execution
        self.context_block.save(update_fields=["current_execution", "result_execution"])
        self.block = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            title="Summary",
            prompt="Explain the most important change.",
        )
        self.create_investigation_block_dependency(block=self.block, depends_on=self.context_block)
        self.url = reverse(
            "sentry-api-0-organization-investigation-block-executions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "block_id": self.block.id,
            },
        )

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_executions.SeerAgentClient"
    )
    def test_starts_text_generation_with_typed_context(self, mock_client: MagicMock) -> None:
        sibling_text = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            title="Release notes",
            content="Checkout was deployed yesterday.",
        )
        failed_query = self.create_investigation_block(
            investigation=self.investigation,
            kind="query",
            title="Failed query",
            prompt="Find transactions",
        )
        failed_execution = self.create_investigation_block_execution(
            block=failed_query,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.FAILED,
            block_version=failed_query.version,
            input_snapshot={"projectIds": [self.project.id]},
            input_fingerprint="f" * 64,
            error={"detail": "Query failed"},
        )
        failed_query.current_execution = failed_execution
        failed_query.save(update_fields=["current_execution"])
        self.context_block.stale_at = timezone.now()
        self.context_block.save(update_fields=["stale_at"])
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args: Any, **kwargs: Any) -> Any:
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.block.version,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        execution = InvestigationBlockExecution.objects.get(id=response.data["id"])
        assert execution.executor == "text_generation"
        context = {item["block_id"]: item for item in execution.input_snapshot["context"]}
        assert set(context) == {
            str(self.context_block.id),
            str(sibling_text.id),
            str(failed_query.id),
        }
        assert context[str(self.context_block.id)]["stale"] is True
        assert context[str(self.context_block.id)]["result"]["tableMarkdown"]
        assert context[str(sibling_text.id)]["status"] == "not_run"
        assert context[str(sibling_text.id)]["content"] == "Checkout was deployed yesterday."
        assert context[str(failed_query.id)]["status"] == "failed"
        assert "result" not in context[str(failed_query.id)]
        call = mock_client.return_value.start_run.call_args
        assert call.kwargs["record_in_history"] is False
        assert "is:unresolved" in call.args[0]
        assert "two or three short paragraphs" in call.args[0]
