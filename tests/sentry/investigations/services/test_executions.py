from __future__ import annotations

from collections.abc import Callable
from typing import Any
from unittest import mock
from uuid import uuid4

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationBlockKind,
    InvestigationParameterType,
)
from sentry.investigations.services.executions import (
    build_block_execution_snapshot,
    create_block_execution,
    mark_block_execution_dispatch_failed,
    mark_block_execution_dispatched,
)
from sentry.investigations.services.investigations import (
    InvestigationValidationError,
)
from sentry.testutils.cases import TestCase


class InvestigationExecutionServiceTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization, slug="alpha")
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Investigation",
        )

    def create_block(self, **kwargs: Any) -> InvestigationBlock:
        kwargs.setdefault("position", 0)
        kwargs.setdefault("kind", InvestigationBlockKind.QUERY)
        kwargs.setdefault("prompt", "What happened?")
        return self.create_investigation_block(investigation=self.investigation, **kwargs)

    def create_execution(
        self, block: InvestigationBlock, **kwargs: Any
    ) -> InvestigationBlockExecution:
        kwargs.setdefault("executor", InvestigationBlockExecutor.CODE_MODE)
        kwargs.setdefault("status", InvestigationBlockExecutionStatus.COMPLETED)
        kwargs.setdefault("block_version", block.version)
        kwargs.setdefault("input_fingerprint", "f" * 64)
        kwargs.setdefault(
            "result",
            {
                "schemaVersion": 1,
                "tableMarkdown": "| count |\n| --- |\n| 1 |",
                "isEmpty": False,
                "queryLinks": [],
            },
        )
        return self.create_investigation_block_execution(block=block, **kwargs)

    def run_block(
        self,
        block: InvestigationBlock,
        *,
        project_ids: list[int] | None = None,
        accessible_project_ids: set[int] | None = None,
        **kwargs: Any,
    ) -> tuple[InvestigationBlockExecution, bool]:
        return create_block_execution(
            block=block,
            expected_investigation_version=self.investigation.version,
            expected_block_version=block.version,
            user_id=self.user.id,
            project_ids=[self.project.id] if project_ids is None else project_ids,
            accessible_project_ids=(
                {self.project.id} if accessible_project_ids is None else accessible_project_ids
            ),
            **kwargs,
        )

    def test_text_context_is_ordered_by_position_then_id(self) -> None:
        target = self.create_block(
            position=2,
            kind=InvestigationBlockKind.TEXT,
            prompt="Summarize this notebook",
            config={"datasetHint": "issues"},
        )
        first = self.create_block(position=1, title="first")
        second = self.create_block(position=1, title="second")

        execution, created = self.run_block(target, project_ids=[])

        assert created
        assert [item["block_id"] for item in execution.input_snapshot["context"]] == [
            str(first.id),
            str(second.id),
        ]
        assert execution.input_snapshot["blockVersion"] == target.version
        assert "datasetHint" not in execution.input_snapshot

    def test_rejects_invalid_query_dataset_hint(self) -> None:
        block = self.create_block(config={"datasetHint": "invalid"})

        with pytest.raises(InvestigationValidationError):
            self.run_block(block)

    def test_rejects_duplicate_project_scope(self) -> None:
        block = self.create_block()
        with pytest.raises(InvestigationValidationError):
            self.run_block(
                block,
                project_ids=[self.project.id, self.project.id],
                accessible_project_ids={self.project.id},
            )

    def test_rejects_inaccessible_project_scope(self) -> None:
        block = self.create_block()
        with pytest.raises(InvestigationValidationError):
            self.run_block(block, accessible_project_ids=set())

    def test_rejects_foreign_organization_project_scope(self) -> None:
        foreign_organization = self.create_organization(owner=self.user)
        foreign_project = self.create_project(organization=foreign_organization)
        block = self.create_block()

        with pytest.raises(InvestigationValidationError):
            self.run_block(
                block,
                project_ids=[foreign_project.id],
                accessible_project_ids={foreign_project.id},
            )

    def test_canonicalizes_project_scope(self) -> None:
        second = self.create_project(organization=self.organization, slug="beta")
        block = self.create_block()

        execution, created = self.run_block(
            block,
            project_ids=[second.id, self.project.id],
            accessible_project_ids={self.project.id, second.id},
        )

        assert created
        expected = sorted((self.project, second), key=lambda project: project.id)
        assert execution.input_snapshot["projectIds"] == [project.id for project in expected]
        assert execution.input_snapshot["projectSlugs"] == [project.slug for project in expected]

    def test_revalidates_project_parameter_access(self) -> None:
        cases: list[tuple[InvestigationParameterType, Callable[[int], Any]]] = [
            (InvestigationParameterType.PROJECT, lambda project_id: project_id),
            (InvestigationParameterType.PROJECT_LIST, lambda project_id: [project_id]),
        ]
        for position, (parameter_type, saved_value) in enumerate(cases):
            with self.subTest(parameter_type=parameter_type.value):
                revoked_project = self.create_project(organization=self.organization)
                parameter = self.create_investigation_parameter(
                    investigation=self.investigation,
                    key=f"project_{position}",
                    label="Project",
                    type=parameter_type,
                    saved_value=saved_value(revoked_project.id),
                    position=position,
                )
                block = self.create_block(position=position)
                self.create_investigation_block_parameter(block=block, parameter=parameter)

                with pytest.raises(InvestigationValidationError):
                    self.run_block(block, accessible_project_ids={self.project.id})

    def test_explicit_request_retry_precedes_mutable_state_validation(self) -> None:
        block = self.create_block()
        request_id = uuid4()
        execution, created = self.run_block(block, request_id=request_id)
        assert created
        self.investigation.version += 1
        self.investigation.save(update_fields=["version"])
        block.version += 1
        block.deleted_at = timezone.now()
        block.save(update_fields=["version", "deleted_at"])

        retried, retry_created = self.run_block(block, request_id=request_id)

        assert retried.id == execution.id
        assert not retry_created

    def test_explicit_request_cannot_be_reused_by_another_block(self) -> None:
        first = self.create_block(position=0)
        second = self.create_block(position=1)
        request_id = uuid4()
        self.run_block(first, request_id=request_id)

        with pytest.raises(InvestigationValidationError):
            self.run_block(second, request_id=request_id)

    def test_does_not_reuse_execution_that_failed_while_snapshotting(self) -> None:
        block = self.create_block()
        failed_execution, created = self.run_block(block)
        assert created

        original_build_snapshot = build_block_execution_snapshot

        def fail_current_execution(**kwargs: Any) -> tuple[dict[str, Any], str]:
            mark_block_execution_dispatch_failed(failed_execution)
            return original_build_snapshot(**kwargs)

        with mock.patch(
            "sentry.investigations.services.executions.build_block_execution_snapshot",
            side_effect=fail_current_execution,
        ):
            replacement, replacement_created = self.run_block(block)

        failed_execution.refresh_from_db()
        assert failed_execution.status == InvestigationBlockExecutionStatus.FAILED
        assert replacement_created
        assert replacement.id != failed_execution.id

    def test_rejects_deleted_dependency(self) -> None:
        dependency = self.create_block(position=0)
        dependency.deleted_at = timezone.now()
        dependency.save(update_fields=["deleted_at"])
        block = self.create_block(position=1)
        self.create_investigation_block_dependency(block=block, depends_on=dependency)

        with pytest.raises(InvestigationValidationError):
            self.run_block(block)

    def test_rejects_malformed_persisted_query_result(self) -> None:
        dependency = self.create_block(position=0)
        execution = self.create_execution(dependency, result={"schemaVersion": 1})
        dependency.result_execution = execution
        dependency.save(update_fields=["result_execution"])
        block = self.create_block(position=1)
        self.create_investigation_block_dependency(block=block, depends_on=dependency)

        with pytest.raises(InvestigationValidationError):
            self.run_block(block)

    def test_dispatch_failure_uses_fixed_payload_and_guarded_transitions(self) -> None:
        block = self.create_block()
        execution, _ = self.run_block(block)
        seer_run = self.create_seer_run(organization=self.organization)

        assert mark_block_execution_dispatch_failed(execution)
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.FAILED
        assert execution.error == {
            "code": "dispatch_failed",
            "message": "The execution could not be started.",
        }

        assert not mark_block_execution_dispatched(execution, seer_run_id=seer_run.id)
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.FAILED
        assert execution.seer_run_id is None

    def test_dispatch_failure_accepts_running_but_not_terminal_execution(self) -> None:
        block = self.create_block()
        execution, _ = self.run_block(block)
        seer_run = self.create_seer_run(organization=self.organization)
        assert mark_block_execution_dispatched(execution, seer_run_id=seer_run.id)
        assert mark_block_execution_dispatch_failed(execution)
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.FAILED

        execution.status = InvestigationBlockExecutionStatus.COMPLETED
        execution.error = None
        execution.save(update_fields=["status", "error"])
        assert not mark_block_execution_dispatch_failed(execution)
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert execution.error is None

    def test_notebook_context_query_count_is_constant(self) -> None:
        one_query_count = self._snapshot_query_count(1)
        many_query_count = self._snapshot_query_count(4)

        assert many_query_count == one_query_count

    def _snapshot_query_count(self, context_block_count: int) -> int:
        investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title=f"Notebook {context_block_count}",
        )
        target = self.create_investigation_block(
            investigation=investigation,
            position=context_block_count,
            kind=InvestigationBlockKind.TEXT,
            prompt="Summarize",
        )
        for position in range(context_block_count):
            context_block = self.create_investigation_block(
                investigation=investigation,
                position=position,
                kind=InvestigationBlockKind.TEXT,
                content=f"Context {position}",
            )
            execution = self.create_execution(context_block)
            self.create_investigation_block_execution_project(
                execution=execution, project=self.project
            )
            context_block.current_execution = execution
            context_block.content_execution = execution
            context_block.save(update_fields=["current_execution", "content_execution"])

        target = type(target).objects.select_related("investigation").get(id=target.id)
        with CaptureQueriesContext(connection) as queries:
            build_block_execution_snapshot(
                block=target,
                projects=[],
                accessible_project_ids={self.project.id},
            )
        return len(queries)
