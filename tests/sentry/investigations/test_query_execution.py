from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse

from sentry.investigations.delivery import deliver_investigation_query_result
from sentry.investigations.models import (
    InvestigationCellExecution,
    InvestigationCellExecutionStatus,
    InvestigationProject,
)
from sentry.seer.models.run import SeerRunType
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature

FEATURES = [
    "organizations:investigations",
    "organizations:investigations-query-execution",
]


def query_result(project_id: int) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "query": {
            "dataset": "errors",
            "query": "is:unresolved",
            "mode": "aggregates",
            "yAxes": ["count()"],
            "timeRange": {"statsPeriod": "24h"},
            "projectIds": [project_id],
        },
        "table": {
            "columns": [{"key": "count()", "label": "Errors", "type": "number"}],
            "rows": [[12]],
            "totalRows": 1,
            "returnedRows": 1,
            "truncated": False,
        },
        "chart": {
            "xAxis": "time",
            "series": [
                {
                    "name": "count()",
                    "data": [{"x": "2026-07-31T12:00:00Z", "y": 12}],
                }
            ],
        },
        "suggestedVisualization": {
            "type": "area",
            "title": "Errors over time",
            "xField": "timestamp",
            "yFields": ["count()"],
        },
        "dataProjectIds": [project_id],
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
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_feature_run(**kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_feature_run.side_effect = start_feature_run
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
        payload = mock_client.return_value.start_feature_run.call_args.kwargs["payload"]
        assert "dataset_hint" not in payload
        assert payload["project_ids"] == [self.project.id]
        assert mock_client.return_value.start_feature_run.call_args.kwargs["flush"] is True

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_retry_while_running_returns_the_same_execution(self, mock_client) -> None:
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_feature_run(**kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_feature_run.side_effect = start_feature_run
        body = {
            "investigationVersion": self.investigation.version,
            "requestId": str(uuid4()),
            "version": self.cell.version,
        }
        first = self.client.post(self.url, data=body, format="json")
        second = self.client.post(self.url, data=body, format="json")

        assert first.status_code == second.status_code == 202
        assert first.data["id"] == second.data["id"]
        assert mock_client.return_value.start_feature_run.call_count == 1

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_new_run_request_supersedes_an_identical_running_execution(self, mock_client) -> None:
        runs = [
            self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN),
            self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN),
        ]

        def start_feature_run(**kwargs):
            run = runs.pop(0)
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_feature_run.side_effect = start_feature_run
        body = {
            "investigationVersion": self.investigation.version,
            "version": self.cell.version,
        }
        first = self.client.post(self.url, data={**body, "requestId": str(uuid4())}, format="json")
        second = self.client.post(self.url, data={**body, "requestId": str(uuid4())}, format="json")

        assert first.status_code == second.status_code == 202
        assert first.data["id"] != second.data["id"]
        assert mock_client.return_value.start_feature_run.call_count == 2
        self.cell.refresh_from_db()
        assert str(self.cell.current_execution.uuid) == second.data["id"]

    @patch("sentry.investigations.endpoints.organization_investigations.SeerAgentClient")
    def test_hidden_template_hint_is_forwarded_without_a_request_dataset(self, mock_client) -> None:
        self.cell.config = {"datasetHint": "metrics"}
        self.cell.save(update_fields=["config"])
        run = self.create_seer_run(organization=self.organization, type=SeerRunType.FEATURE_RUN)

        def start_feature_run(**kwargs):
            kwargs["on_run_created"](run)
            return run

        mock_client.return_value.start_feature_run.side_effect = start_feature_run
        response = self.client.post(
            self.url,
            data={
                "investigationVersion": self.investigation.version,
                "version": self.cell.version,
            },
            format="json",
        )

        assert response.status_code == 202
        payload = mock_client.return_value.start_feature_run.call_args.kwargs["payload"]
        assert payload["dataset_hint"] == "metrics"

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

    def test_visualization_suggestion_separates_display_edits_from_data_edits(self) -> None:
        url = reverse(
            "sentry-api-0-organization-investigation-cell-visualization-suggestion",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_uuid": self.investigation.uuid,
                "cell_uuid": self.cell.uuid,
            },
        )
        visualization = query_result(self.project.id)["suggestedVisualization"]
        display_response = self.client.post(
            url,
            data={
                "currentResult": query_result(self.project.id),
                "visualization": visualization,
                "requestedChange": "Make this a stacked line chart and hide legend",
                "currentIntent": self.cell.prompt,
            },
            format="json",
        )
        assert display_response.status_code == 200, display_response.data
        assert display_response.data["existingResultSufficient"] is True
        assert display_response.data["visualization"]["type"] == "line"
        assert display_response.data["visualization"]["stacked"] is True
        assert display_response.data["visualization"]["showLegend"] is False

        data_response = self.client.post(
            url,
            data={
                "currentResult": query_result(self.project.id),
                "visualization": visualization,
                "requestedChange": "Group this by release",
                "currentIntent": self.cell.prompt,
            },
            format="json",
        )
        assert data_response.status_code == 200, data_response.data
        assert data_response.data["existingResultSufficient"] is False
        assert data_response.data["revisedQueryIntent"].endswith("grouped by release.")


class InvestigationQueryDeliveryTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Delivery"
        )
        self.cell = self.create_investigation_cell(
            investigation=self.investigation, kind="query", prompt="Count errors"
        )
        self.run = self.create_seer_run(
            organization=self.organization, type=SeerRunType.FEATURE_RUN
        )
        self.execution = self.create_investigation_cell_execution(
            cell=self.cell,
            seer_run=self.run,
            executor="code_mode",
            status=InvestigationCellExecutionStatus.RUNNING,
            cell_version=self.cell.version,
            input_snapshot={"projectIds": [self.project.id]},
            input_fingerprint="a" * 64,
        )
        self.cell.current_execution = self.execution
        self.cell.save(update_fields=["current_execution"])

    def test_delivery_validates_persists_and_is_idempotent(self) -> None:
        result = query_result(self.project.id)
        deliver_investigation_query_result(
            self.organization.id, self.run.uuid, "completed", result, None
        )
        deliver_investigation_query_result(
            self.organization.id, self.run.uuid, "completed", result, None
        )

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationCellExecutionStatus.COMPLETED
        assert self.execution.result["schemaVersion"] == 1
        assert self.execution.result["query"]["dataset"] == "errors"
        assert self.execution.result["table"]["rows"] == [[12]]
        assert list(self.execution.data_projects.all()) == [self.project]

    def test_invalid_project_provenance_fails_closed(self) -> None:
        foreign_project = self.create_project(organization=self.create_organization())
        deliver_investigation_query_result(
            self.organization.id,
            self.run.uuid,
            "completed",
            query_result(foreign_project.id),
            None,
        )

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationCellExecutionStatus.FAILED
        assert self.execution.error["code"] == "invalid_project_provenance"

    def test_superseded_completion_does_not_replace_the_current_execution(self) -> None:
        newer = self.create_investigation_cell_execution(
            cell=self.cell,
            executor="code_mode",
            status=InvestigationCellExecutionStatus.RUNNING,
            cell_version=self.cell.version,
            input_snapshot={"projectIds": [self.project.id]},
            input_fingerprint="b" * 64,
        )
        self.cell.current_execution = newer
        self.cell.save(update_fields=["current_execution"])

        deliver_investigation_query_result(
            self.organization.id,
            self.run.uuid,
            "completed",
            query_result(self.project.id),
            None,
        )

        self.cell.refresh_from_db()
        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationCellExecutionStatus.COMPLETED
        assert self.cell.current_execution == newer
