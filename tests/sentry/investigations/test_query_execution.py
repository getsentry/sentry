from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationCellExecution,
    InvestigationCellExecutionStatus,
    InvestigationProject,
)
from sentry.seer.models.run import SeerRunType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURES = [
    "organizations:investigations",
    "organizations:investigations-query-execution",
]


def query_result(project_id: int) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "tableMarkdown": "| Query | Errors |\n| --- | ---: |\n| is:unresolved | 12 |",
        "chart": {"visualization": "area", "series": []},
        "preferredView": "chart",
        "isEmpty": False,
        "chartUnavailableReason": None,
        "queryLinks": [],
    }


@with_feature(FEATURES)
class InvestigationQueryExecutionEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Query execution",
        )
        self.create_investigation_permissions(investigation=self.investigation)
        InvestigationProject.objects.create(investigation=self.investigation, project=self.project)
        self.cell = self.create_investigation_cell(
            investigation=self.investigation,
            kind="query",
            prompt="Show unresolved errors over the last day",
            display={"type": "table"},
        )
        self.url = reverse(
            "sentry-api-0-organization-investigation-cell-execute",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": self.cell.uuid,
            },
        )

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_starts_and_persists_an_immutable_execution(self, mock_client) -> None:
        self.investigation.filters = {
            "datetime": {"period": "24h"},
            "environments": ["production"],
            "interval": "1h",
            "releases": ["backend@1.2.3"],
        }
        self.investigation.save(update_fields=["filters"])
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args, **kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.cell.version,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        execution = InvestigationCellExecution.objects.get(uuid=response.data["id"])
        assert execution.status == InvestigationCellExecutionStatus.RUNNING
        assert execution.seer_run == run
        assert execution.input_snapshot["prompt"] == self.cell.prompt
        assert execution.input_snapshot["projectIds"] == [self.project.id]
        self.cell.refresh_from_db()
        assert self.cell.current_execution == execution
        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert '"projectSlugs":["' + self.project.slug + '"]' in prompt
        assert '"environments":["production"]' in prompt
        assert '"releases":["backend@1.2.3"]' in prompt
        assert mock_client.return_value.start_run.call_args.kwargs["record_in_history"] is False

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_retry_while_running_returns_the_same_execution(self, mock_client) -> None:
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args, **kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        body = {
            "investigationVersion": self.investigation.version,
            "requestId": str(uuid4()),
            "version": self.cell.version,
        }
        first = self.client.post(self.url, data=body, format="json")
        second = self.client.post(self.url, data=body, format="json")

        assert first.status_code == second.status_code == 202
        assert first.data["id"] == second.data["id"]
        assert mock_client.return_value.start_run.call_count == 1

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_new_run_request_supersedes_an_identical_running_execution(self, mock_client) -> None:
        runs = [
            self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN),
            self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN),
        ]

        def start_run(*args, **kwargs):
            run = runs.pop(0)
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        body = {
            "investigationVersion": self.investigation.version,
            "version": self.cell.version,
        }
        first = self.client.post(self.url, data={**body, "requestId": str(uuid4())}, format="json")
        second = self.client.post(self.url, data={**body, "requestId": str(uuid4())}, format="json")

        assert first.status_code == second.status_code == 202
        assert first.data["id"] != second.data["id"]
        assert mock_client.return_value.start_run.call_count == 2
        self.cell.refresh_from_db()
        assert str(self.cell.current_execution.uuid) == second.data["id"]

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_hidden_template_hint_is_forwarded_without_a_request_dataset(self, mock_client) -> None:
        self.cell.config = {"datasetHint": "metrics"}
        self.cell.save(update_fields=["config"])
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args, **kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.cell.version,
            },
            format="json",
        )

        assert response.status_code == 202
        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert '"datasetHint":"metrics"' in prompt

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_sends_actual_upstream_cell_content_as_query_context(self, mock_client) -> None:
        context_cell = self.create_investigation_cell(
            investigation=self.investigation,
            kind="text",
            title="Investigation goal",
            content="Focus on the checkout regression.",
        )
        self.create_investigation_cell_dependency(cell=self.cell, depends_on=context_cell)
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args, **kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.cell.version,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert "Focus on the checkout regression." in prompt

    def test_query_execution_subflag_is_required(self) -> None:
        with self.feature({"organizations:investigations-query-execution": False}):
            response = self.client.post(
                self.url,
                data={
                    "investigationVersion": self.investigation.version,
                    "version": self.cell.version,
                },
                format="json",
            )
        assert response.status_code == 404


@with_feature(FEATURES)
class InvestigationTextExecutionEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Text generation",
        )
        self.create_investigation_permissions(investigation=self.investigation)
        InvestigationProject.objects.create(investigation=self.investigation, project=self.project)
        self.context_cell = self.create_investigation_cell(
            investigation=self.investigation,
            kind="query",
            title="Error trend",
            prompt="Show errors over time",
        )
        context_execution = self.create_investigation_cell_execution(
            cell=self.context_cell,
            executor="code_mode",
            status=InvestigationCellExecutionStatus.COMPLETED,
            cell_version=self.context_cell.version,
            input_snapshot={"projectIds": [self.project.id]},
            input_fingerprint="c" * 64,
            result=query_result(self.project.id),
        )
        context_execution.data_projects.add(self.project)
        self.context_cell.current_execution = context_execution
        self.context_cell.result_execution = context_execution
        self.context_cell.save(update_fields=["current_execution", "result_execution"])
        self.cell = self.create_investigation_cell(
            investigation=self.investigation,
            kind="text",
            title="Summary",
            prompt="Explain the most important change.",
        )
        self.create_investigation_cell_dependency(cell=self.cell, depends_on=self.context_cell)
        self.url = reverse(
            "sentry-api-0-organization-investigation-cell-execute",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": self.cell.uuid,
            },
        )

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_starts_text_generation_with_typed_context(self, mock_client) -> None:
        sibling_text = self.create_investigation_cell(
            investigation=self.investigation,
            kind="text",
            title="Release notes",
            content="Checkout was deployed yesterday.",
        )
        failed_query = self.create_investigation_cell(
            investigation=self.investigation,
            kind="query",
            title="Failed query",
            prompt="Find transactions",
        )
        failed_execution = self.create_investigation_cell_execution(
            cell=failed_query,
            executor="code_mode",
            status=InvestigationCellExecutionStatus.FAILED,
            cell_version=failed_query.version,
            input_snapshot={"projectIds": [self.project.id]},
            input_fingerprint="f" * 64,
            error={"detail": "Query failed"},
        )
        failed_query.current_execution = failed_execution
        failed_query.save(update_fields=["current_execution"])
        self.context_cell.stale_at = timezone.now()
        self.context_cell.save(update_fields=["stale_at"])
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_run(*args, **kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_run.side_effect = start_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.cell.version,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        execution = InvestigationCellExecution.objects.get(uuid=response.data["id"])
        assert execution.executor == "text_generation"
        context = {item["cell_id"]: item for item in execution.input_snapshot["context"]}
        assert set(context) == {
            str(self.context_cell.uuid),
            str(sibling_text.uuid),
            str(failed_query.uuid),
        }
        assert context[str(self.context_cell.uuid)]["stale"] is True
        assert context[str(self.context_cell.uuid)]["result"]["tableMarkdown"]
        assert context[str(sibling_text.uuid)]["status"] == "not_run"
        assert context[str(sibling_text.uuid)]["content"] == "Checkout was deployed yesterday."
        assert context[str(failed_query.uuid)]["status"] == "failed"
        assert "result" not in context[str(failed_query.uuid)]
        call = mock_client.return_value.start_run.call_args
        assert call.kwargs["record_in_history"] is False
        assert "is:unresolved" in call.args[0]
