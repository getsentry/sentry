from __future__ import annotations

from django.db import connection
from django.test.utils import CaptureQueriesContext

from sentry.api.serializers import serialize
from sentry.investigations.endpoints.serializers import (
    InvestigationBlockSerializer,
    InvestigationBlockSerializerResponse,
)
from sentry.investigations.models import (
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
)
from sentry.models.project import Project
from sentry.testutils.cases import TestCase


class InvestigationBlockSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.block = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="query"
        )

    def serialize_block(
        self, accessible_project_ids: set[int] | None = None
    ) -> InvestigationBlockSerializerResponse:
        return serialize(
            self.block,
            self.user,
            InvestigationBlockSerializer(
                accessible_project_ids=(
                    {self.project.id} if accessible_project_ids is None else accessible_project_ids
                )
            ),
        )

    def completed_execution(self, project: Project | None = None) -> InvestigationBlockExecution:
        execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=1,
            input_fingerprint="f" * 64,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={"schemaVersion": 1},
        )
        self.create_investigation_block_execution_project(
            execution=execution, project=project or self.project
        )
        self.block.update(
            current_execution=execution,
            content_execution=execution,
            result_execution=execution,
        )
        return execution

    def test_reports_not_run_without_an_execution(self) -> None:
        result = self.serialize_block()

        assert result["outputStatus"] == "notRun"
        assert result["output"] is None
        assert result["currentExecution"] is None

    def test_exposes_output_when_every_data_project_is_accessible(self) -> None:
        execution = self.completed_execution()

        result = self.serialize_block()

        assert result["outputStatus"] == "available"
        assert result["output"] == {"schemaVersion": 1}
        assert result["currentExecution"] is not None
        assert result["currentExecution"]["id"] == str(execution.id)

    def test_withholds_output_when_a_data_project_is_inaccessible(self) -> None:
        self.completed_execution()

        result = self.serialize_block(accessible_project_ids=set())

        assert result["outputStatus"] == "restricted"
        assert result["output"] is None

    def test_withholds_output_when_only_some_data_projects_are_accessible(self) -> None:
        other_project = self.create_project(organization=self.organization)
        execution = self.completed_execution()
        self.create_investigation_block_execution_project(
            execution=execution, project=other_project
        )

        result = self.serialize_block(accessible_project_ids={self.project.id})

        assert result["outputStatus"] == "restricted"
        assert result["output"] is None

    def test_exposes_execution_error_when_projects_are_accessible(self) -> None:
        execution = self.completed_execution()
        execution.error = {"detail": "Query failed"}
        execution.save(update_fields=["error"])

        result = self.serialize_block()

        assert result["currentExecution"] is not None
        assert result["currentExecution"]["error"] == {"detail": "Query failed"}

    def test_redacts_execution_error_when_projects_are_inaccessible(self) -> None:
        visible_execution = self.completed_execution()
        restricted_project = self.create_project(organization=self.organization)
        restricted_execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=2,
            input_fingerprint="a" * 64,
            status=InvestigationBlockExecutionStatus.FAILED,
            error={"detail": "Sensitive query failed"},
        )
        self.create_investigation_block_execution_project(
            execution=restricted_execution, project=restricted_project
        )
        self.block.update(
            current_execution=restricted_execution,
            result_execution=visible_execution,
        )

        result = self.serialize_block(accessible_project_ids={self.project.id})

        assert result["currentExecution"] is not None
        assert result["currentExecution"]["error"] is None

    def test_reports_a_pending_execution_status_verbatim(self) -> None:
        execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=1,
            input_fingerprint="f" * 64,
        )
        self.block.update(current_execution=execution, result_execution=execution)

        assert self.serialize_block()["outputStatus"] == (InvestigationBlockExecutionStatus.PENDING)

    def test_blanks_restricted_text_content(self) -> None:
        self.block.update(kind="text", content="Secret finding", generated_content="Secret draft")
        self.completed_execution()

        result = self.serialize_block(accessible_project_ids=set())

        assert result["outputStatus"] == "restricted"
        assert result["content"] == ""
        assert result["generatedContent"] == ""

    def test_keeps_text_content_when_projects_are_accessible(self) -> None:
        self.block.update(kind="text", content="Visible finding")
        self.completed_execution()

        assert self.serialize_block()["content"] == "Visible finding"

    def test_serializes_dependencies_and_parameter_keys(self) -> None:
        upstream = self.create_investigation_block(investigation=self.investigation, position=1)
        self.create_investigation_block_dependency(block=self.block, depends_on=upstream)
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        self.create_investigation_block_parameter(block=self.block, parameter=parameter)

        result = self.serialize_block()

        assert result["dependencies"] == [str(upstream.id)]
        assert result["parameterKeys"] == ["environment"]

    def test_query_count_does_not_grow_with_the_number_of_blocks(self) -> None:
        for position in range(1, 10):
            self.create_investigation_block(investigation=self.investigation, position=position)

        from sentry.investigations.models import InvestigationBlock

        all_blocks = list(
            InvestigationBlock.objects.filter(investigation=self.investigation).order_by("id")
        )
        serializer = InvestigationBlockSerializer(accessible_project_ids={self.project.id})

        with CaptureQueriesContext(connection) as few_queries:
            serialize(all_blocks[:2], self.user, serializer)

        with CaptureQueriesContext(connection) as many_queries:
            serialize(all_blocks, self.user, serializer)

        assert len(all_blocks) == 10
        assert len(many_queries.captured_queries) == len(few_queries.captured_queries)

    def test_keeps_readable_markdown_when_a_newer_run_is_restricted(self) -> None:
        self.block.update(
            kind="text", content="Readable markdown", generated_content="Readable draft"
        )
        other_project = self.create_project(organization=self.organization)
        content_execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=1,
            input_fingerprint="a" * 64,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={"schemaVersion": 1},
        )
        self.create_investigation_block_execution_project(
            execution=content_execution, project=self.project
        )
        pending_execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=2,
            input_fingerprint="b" * 64,
        )
        self.create_investigation_block_execution_project(
            execution=pending_execution, project=other_project
        )
        self.block.update(content_execution=content_execution, current_execution=pending_execution)

        result = self.serialize_block(accessible_project_ids={self.project.id})

        assert result["outputStatus"] == "restricted"
        assert result["output"] is None
        assert result["content"] == "Readable markdown"
        assert result["generatedContent"] == "Readable draft"

    def test_query_count_is_constant_for_a_bare_queryset(self) -> None:
        for position in range(1, 6):
            block = self.create_investigation_block(
                investigation=self.investigation, position=position, kind="query"
            )
            execution = self.create_investigation_block_execution(
                block=block,
                executor="manual",
                block_version=1,
                input_fingerprint="f" * 64,
                status=InvestigationBlockExecutionStatus.COMPLETED,
                result={"schemaVersion": 1},
            )
            self.create_investigation_block_execution_project(
                execution=execution, project=self.project
            )
            block.update(
                current_execution=execution,
                content_execution=execution,
                result_execution=execution,
            )
        self.completed_execution()

        serializer = InvestigationBlockSerializer(accessible_project_ids={self.project.id})

        def block_queryset() -> list[InvestigationBlock]:
            return list(
                InvestigationBlock.objects.filter(investigation=self.investigation).order_by("id")
            )

        with CaptureQueriesContext(connection) as one_block:
            serialize(block_queryset()[:1], self.user, serializer)

        with CaptureQueriesContext(connection) as all_blocks:
            results = serialize(block_queryset(), self.user, serializer)

        assert len(results) == 6
        assert len(all_blocks.captured_queries) == len(one_block.captured_queries)
