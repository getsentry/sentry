from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
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
    InvestigationSourceType,
)
from sentry.investigations.services.executions import (
    build_block_execution_snapshot,
    create_block_execution,
    mark_block_execution_dispatch_failed,
    mark_block_execution_dispatch_started,
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

    def test_source_snapshot_is_captured_separately_from_mutable_filters(self) -> None:
        source = {
            "type": InvestigationSourceType.METRIC_OPEN_PERIOD,
            "ref": {"groupId": "1", "openPeriodId": "2"},
            "snapshot": {
                "monitor": {"name": "Checkout errors"},
                "analysisWindow": {"breachStart": "2026-08-01T00:00:00+00:00"},
            },
        }
        self.investigation.update(
            source=source,
            source_type=InvestigationSourceType.BREACHED_METRIC,
            source_ref=source["ref"],
            source_key="legacy-key",
            source_revision=1,
            filters={"environment": ["production"], "breachedMetric": source["snapshot"]},
        )
        block = self.create_block()

        execution, created = self.run_block(block)

        assert created
        assert execution.input_snapshot["source"] == source
        assert execution.input_snapshot["filters"] == {"environment": ["production"]}

    def test_query_refinement_snapshots_its_previous_chart(self) -> None:
        block = self.create_block(title="Error volume")
        previous = self.create_execution(
            block,
            result={
                "schemaVersion": 1,
                "tableMarkdown": "| day | errors |\n| --- | ---: |\n| Aug 11 | 17 |",
                "chart": {
                    "title": "Issue volume",
                    "subtitle": "Last 7 days | 17 total errors",
                    "visualization": "line",
                    "x_axis": "time",
                    "y_axis_unit": "number",
                    "series": [
                        {
                            "name": "Errors",
                            "data": [{"x": "2026-08-11T00:00:00+00:00", "y": 17}],
                        }
                    ],
                },
                "preferredView": "chart",
                "isEmpty": False,
                "chartUnavailableReason": None,
                "queryLinks": [],
            },
        )
        previous.data_projects.add(self.project)
        empty_refinement = self.create_execution(
            block,
            result={
                "schemaVersion": 1,
                "tableMarkdown": "| Note |\n| --- |\n| No prior chart data found |",
                "chart": None,
                "preferredView": "table",
                "isEmpty": True,
                "chartUnavailableReason": "No prior chart data found.",
                "queryLinks": [],
            },
        )
        block.result_execution = empty_refinement
        block.save(update_fields=["result_execution"])

        execution, created = self.run_block(block)

        assert created
        current_context = execution.input_snapshot["context"][0]
        assert current_context["currentBlock"] is True
        assert current_context["visibleExecutionId"] == str(previous.id)
        assert current_context["result"]["chart"]["visualization"] == "line"
        assert execution.input_snapshot["contextDataProjectIds"] == [self.project.id]

    def test_rejects_invalid_query_dataset_hint(self) -> None:
        block = self.create_block(config={"datasetHint": "invalid"})

        with pytest.raises(InvestigationValidationError):
            self.run_block(block)

    def test_refinement_keeps_the_original_window_after_ten_days(self) -> None:
        original_end = timezone.now() - timedelta(days=10)
        original_start = original_end - timedelta(days=6)
        self.investigation.update(filters={"statsPeriod": "6d"})
        block = self.create_block(prompt="Show a bar chart instead")
        previous = self.create_execution(
            block,
            started_at=original_end,
            input_snapshot={"filters": {"statsPeriod": "6d", "environment": ["production"]}},
        )
        original_link = {
            "kind": "telemetry",
            "params": {"dataset": "errors", "query": "", "stats_period": "6d"},
        }
        previous.update(result={**previous.result, "queryLinks": [original_link]})
        previous.data_projects.add(self.project)
        block.update(result_execution=previous)

        snapshot, _ = build_block_execution_snapshot(
            block=block, projects=[self.project], accessible_project_ids={self.project.id}
        )

        current = snapshot["context"][0]
        assert current["result"]["queryLinks"] == [
            {
                "kind": "telemetry",
                "params": {
                    "dataset": "errors",
                    "query": "",
                    "start": original_start.isoformat(),
                    "end": original_end.isoformat(),
                },
            }
        ]
        assert snapshot["queryContext"]["filters"] == {
            "environment": ["production"],
            "start": original_start.isoformat(),
            "end": original_end.isoformat(),
        }
        previous.refresh_from_db()
        assert previous.result["queryLinks"] == [original_link]

        refined = self.create_execution(
            block,
            started_at=timezone.now(),
            input_snapshot=snapshot,
            result=current["result"],
        )
        refined.data_projects.add(self.project)
        block.update(result_execution=refined)
        self.investigation.update(filters={"statsPeriod": "24h"})

        next_snapshot, _ = build_block_execution_snapshot(
            block=block, projects=[self.project], accessible_project_ids={self.project.id}
        )

        assert (
            next_snapshot["context"][0]["result"]["queryLinks"] == current["result"]["queryLinks"]
        )
        assert next_snapshot["queryContext"] == snapshot["queryContext"]

    def test_refinement_keeps_explicit_query_bounds_and_original_source(self) -> None:
        time_range = {"start": "2025-08-01T00:00:00Z", "end": "2025-08-07T00:00:00Z"}
        source = {"type": "manual", "timeRange": time_range}
        block = self.create_block()
        previous = self.create_execution(block, input_snapshot={"source": source})
        link = {"kind": "telemetry", "params": {"dataset": "errors", **time_range}}
        previous.update(result={**previous.result, "queryLinks": [link]})
        previous.data_projects.add(self.project)
        block.update(result_execution=previous)
        self.investigation.update(source={"type": "manual", "prompt": "Changed source"})

        snapshot, _ = build_block_execution_snapshot(
            block=block, projects=[self.project], accessible_project_ids={self.project.id}
        )

        assert snapshot["context"][0]["queryContext"]["source"] == source
        assert snapshot["context"][0]["result"]["queryLinks"] == [link]

    def test_relative_filters_keep_the_same_request_fingerprint(self) -> None:
        self.investigation.update(filters={"statsPeriod": "6d"})
        block = self.create_block()
        started_at = timezone.now()
        with mock.patch(
            "sentry.investigations.services.executions.timezone.now", return_value=started_at
        ):
            _, first = build_block_execution_snapshot(
                block=block, projects=[self.project], accessible_project_ids={self.project.id}
            )
        with mock.patch(
            "sentry.investigations.services.executions.timezone.now",
            return_value=started_at + timedelta(minutes=1),
        ):
            _, retry = build_block_execution_snapshot(
                block=block, projects=[self.project], accessible_project_ids={self.project.id}
            )

        assert first == retry

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

    def test_snapshots_the_resolved_investigation_source(self) -> None:
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": "30", "openPeriodId": "85"},
            "snapshot": {
                "analysisWindow": {
                    "baselineStart": "2026-08-11T01:21:15+00:00",
                    "breachStart": "2026-08-14T23:56:02+00:00",
                    "end": "2026-08-18T22:30:49+00:00",
                },
                "monitor": {
                    "name": "Mobile API error volume",
                    "query": "fixture_metric:mobile-api-errors",
                    "aggregate": "count()",
                    "direction": "above",
                },
            },
        }
        self.investigation.update(source=source)
        block = self.create_block()

        execution, created = self.run_block(block)

        assert created
        assert execution.input_snapshot["organizationSlug"] == self.organization.slug
        assert execution.input_snapshot["source"] == source

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

    def test_dispatch_failure_does_not_overwrite_dispatched_or_terminal_execution(self) -> None:
        block = self.create_block()
        execution, _ = self.run_block(block)
        seer_run = self.create_seer_run(organization=self.organization)
        assert mark_block_execution_dispatched(execution, seer_run_id=seer_run.id)
        assert not mark_block_execution_dispatch_failed(execution)
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.RUNNING
        assert execution.seer_run_id == seer_run.id

        execution.status = InvestigationBlockExecutionStatus.COMPLETED
        execution.error = None
        execution.save(update_fields=["status", "error"])
        assert not mark_block_execution_dispatch_failed(execution)
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert execution.error is None

    def test_stale_dispatch_claim_fences_the_previous_worker(self) -> None:
        block = self.create_block()
        execution, _ = self.run_block(block)
        first_claim = mark_block_execution_dispatch_started(execution)
        assert first_claim is not None
        execution.update(started_at=timezone.now() - timedelta(minutes=6))
        second_claim = mark_block_execution_dispatch_started(execution)
        assert second_claim is not None
        seer_run = self.create_seer_run(organization=self.organization)

        assert not mark_block_execution_dispatch_failed(execution, dispatch_claimed_at=first_claim)
        assert not mark_block_execution_dispatched(
            execution,
            seer_run_id=seer_run.id,
            dispatch_claimed_at=first_claim,
        )
        assert mark_block_execution_dispatched(
            execution,
            seer_run_id=seer_run.id,
            dispatch_claimed_at=second_claim,
        )
        assert not mark_block_execution_dispatch_failed(execution, dispatch_claimed_at=second_claim)

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
