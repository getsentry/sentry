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

    def serialize_block(self) -> InvestigationBlockSerializerResponse:
        return serialize(
            self.block,
            self.user,
            InvestigationBlockSerializer(),
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

    def test_exposes_output(self) -> None:
        execution = self.completed_execution()

        result = self.serialize_block()

        assert result["outputStatus"] == "available"
        assert result["output"] == {"schemaVersion": 1}
        assert result["currentExecution"] is not None
        assert result["currentExecution"]["id"] == str(execution.id)

    def test_exposes_output_from_multiple_projects(self) -> None:
        other_project = self.create_project(organization=self.organization)
        execution = self.completed_execution()
        self.create_investigation_block_execution_project(
            execution=execution, project=other_project
        )

        result = self.serialize_block()

        assert result["outputStatus"] == "available"
        assert result["output"] == {"schemaVersion": 1}

    def test_exposes_execution_error(self) -> None:
        execution = self.completed_execution()
        execution.error = {"detail": "Query failed"}
        execution.save(update_fields=["error"])

        result = self.serialize_block()

        assert result["currentExecution"] is not None
        assert result["currentExecution"]["error"] == {"detail": "Query failed"}

    def test_exposes_error_from_a_new_project(self) -> None:
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

        result = self.serialize_block()

        assert result["currentExecution"] is not None
        assert result["currentExecution"]["error"] == {"detail": "Sensitive query failed"}

    def test_reports_a_pending_execution_status_verbatim(self) -> None:
        execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=1,
            input_fingerprint="f" * 64,
        )
        self.block.update(current_execution=execution, result_execution=execution)

        assert self.serialize_block()["outputStatus"] == (InvestigationBlockExecutionStatus.PENDING)

    def test_exposes_generated_text_content(self) -> None:
        self.block.update(kind="text", content="Secret finding", generated_content="Secret draft")
        self.completed_execution()

        result = self.serialize_block()

        assert result["outputStatus"] == "available"
        assert result["content"] == "Secret finding"
        assert result["generatedContent"] == "Secret draft"

    def test_keeps_text_content(self) -> None:
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
        serializer = InvestigationBlockSerializer()

        with CaptureQueriesContext(connection) as few_queries:
            serialize(all_blocks[:2], self.user, serializer)

        with CaptureQueriesContext(connection) as many_queries:
            serialize(all_blocks, self.user, serializer)

        assert len(all_blocks) == 10
        assert len(many_queries.captured_queries) == len(few_queries.captured_queries)

    def test_keeps_readable_markdown_during_a_new_project_run(self) -> None:
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

        result = self.serialize_block()

        assert result["outputStatus"] == InvestigationBlockExecutionStatus.PENDING
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

        serializer = InvestigationBlockSerializer()

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
