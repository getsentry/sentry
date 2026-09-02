from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from sentry.investigations.agent import (
    _maybe_start_title_generation,
    _parse_completion_metadata,
    sanitize_state,
    start_execution_run,
    synchronize_execution,
    synchronize_title,
    title_generation_preview,
)
from sentry.investigations.models import InvestigationBlockExecutionStatus
from sentry.investigations.services.investigations import DEFAULT_INVESTIGATION_TITLE
from sentry.investigations.telemetry import (
    record_execution_completed,
    record_investigation_completed,
)
from sentry.seer.agent.client_models import (
    MemoryBlock,
    Message,
    SeerRunState,
    ToolCall,
    ToolLink,
    ToolResult,
)
from sentry.seer.models.run import SeerRunType
from sentry.testutils.cases import TestCase
from sentry.utils import json


def state(*, blocks: list[MemoryBlock], status: str = "completed") -> SeerRunState:
    return SeerRunState(
        run_id=42,
        blocks=blocks,
        status=status,
        updated_at="2026-08-03T00:00:00Z",
    )


def completion_metadata(
    *,
    title: str = "Daily error volume spike",
    summary: str = "Error volume crossed threshold",
    description: str = "One endpoint drove most errors.\nRoll back the latest endpoint change.",
) -> str:
    return json.dumps(
        {
            "title": title,
            "summary": summary,
            "summary_description": description,
        }
    )


def test_completion_metadata_accepts_concise_variable_summary_lengths() -> None:
    assert (
        _parse_completion_metadata(completion_metadata(summary="Error threshold exceeded"))
        is not None
    )


def test_completion_metadata_accepts_single_line_description() -> None:
    assert (
        _parse_completion_metadata(
            completion_metadata(description="Checkout errors came from one endpoint.")
        )
        is not None
    )


def test_completion_metadata_ignores_extra_keys() -> None:
    payload = json.loads(completion_metadata())
    payload["confidence"] = 0.9

    metadata = _parse_completion_metadata(json.dumps(payload))

    assert metadata == {
        "title": "Daily error volume spike",
        "summary": "Error volume crossed threshold",
        "summary_description": (
            "One endpoint drove most errors.\nRoll back the latest endpoint change."
        ),
    }
    assert (
        _parse_completion_metadata(
            completion_metadata(summary="Error volume crossed the configured alert threshold")
        )
        is not None
    )


class InvestigationAgentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Already titled",
        )
        self.block = self.create_investigation_block(
            investigation=self.investigation,
            kind="query",
            prompt="Count errors",
        )
        self.seer_run = self.create_seer_run(
            organization=self.organization,
            type=SeerRunType.EXPLORER,
            seer_run_state_id=42,
        )
        self.execution = self.create_investigation_block_execution(
            block=self.block,
            seer_run=self.seer_run,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.RUNNING,
            block_version=self.block.version,
            input_snapshot={
                "projectIds": [self.project.id],
                "projectSlugs": [self.project.slug],
            },
        )
        self.block.current_execution = self.execution
        self.block.save(update_fields=["current_execution"])

    def test_completed_query_keeps_result_and_source_projects(self) -> None:
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="query",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args=json.dumps(
                                    {
                                        "code": (
                                            "sentry.telemetry_live_search("
                                            "'count errors', 'errors', "
                                            f"project_slugs=['{self.project.slug}'])"
                                        )
                                    }
                                ),
                            )
                        ],
                    ),
                    tool_results=[
                        ToolResult(
                            tool_call_id="call",
                            tool_call_function="sentry_api_execute",
                            content=(
                                '<UNTRUSTED_DATA source="sentry_api" trust="UNTRUSTED">\n'
                                "{'result': '12 errors', 'link_params': "
                                "{'dataset': 'errors', 'query': 'is:unresolved', "
                                f"'project_slugs': ['{self.project.slug}']}}}}\n"
                                "</UNTRUSTED_DATA>"
                            ),
                        )
                    ],
                ),
                MemoryBlock(
                    id="result",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content=(
                            '{"tableMarkdown":"| Errors |\\n| ---: |\\n| 12 |",'
                            '"chart":null,"preferredView":"table","isEmpty":false,'
                            '"chartUnavailableReason":"A chart is not useful."}'
                        ),
                    ),
                ),
            ]
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        self.block.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert self.execution.result["tableMarkdown"].startswith("| Errors |")
        assert self.execution.result["queryLinks"][0]["kind"] == "telemetry"
        assert list(self.execution.data_projects.all()) == [self.project]
        assert self.block.result_execution == self.execution

    def test_completed_text_keeps_snapshotted_context_projects(self) -> None:
        self.block.kind = "text"
        self.block.save(update_fields=["kind"])
        self.execution.input_snapshot = {"contextDataProjectIds": [self.project.id]}
        self.execution.save(update_fields=["input_snapshot"])
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="result",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content='{"markdown":"Checkout errors increased after deployment."}',
                    ),
                )
            ]
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert list(self.execution.data_projects.all()) == [self.project]

    def test_completed_query_keeps_reused_result_projects(self) -> None:
        self.execution.input_snapshot["projectIds"] = []
        self.execution.input_snapshot["contextDataProjectIds"] = [self.project.id]
        self.execution.save(update_fields=["input_snapshot"])
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="result",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content=(
                            '{"tableMarkdown":"| Errors |\\n| ---: |\\n| 12 |",'
                            '"chart":null,"preferredView":"table","isEmpty":false,'
                            '"chartUnavailableReason":"Reused the previous result."}'
                        ),
                    ),
                )
            ]
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert list(self.execution.data_projects.all()) == [self.project]

    def test_start_run_requests_a_final_response_without_an_artifact_writer(self) -> None:
        client = MagicMock()
        self.execution.input_snapshot["source"] = {
            "snapshot": {
                "monitor": {"name": "Checkout errors"},
                "analysisWindow": {"breachStart": "2026-08-01T00:00:00+00:00"},
            }
        }

        start_execution_run(self.execution, self.organization, self.user, client)

        prompt = client.start_run.call_args.args[0]
        options = client.start_run.call_args.kwargs
        assert "write or save the result" in prompt
        assert "project_slugs as a literal list of string values" in prompt
        assert "Never build that argument from a variable" in prompt
        assert "Do not import sentry, sentry_sdk, or tool input types" in prompt
        assert 'title="Error volume"' in prompt
        assert "inline plain dictionaries" in prompt
        assert 'x_axis="time", y_axis_unit="number"' in prompt
        assert "offset-bearing ISO 8601 timestamps" in prompt
        assert "source.snapshot" in prompt
        assert "do not report them missing merely because parameters is empty" in prompt
        assert "first character must be { and the last character must be }" in prompt
        assert "Do not wrap the object in a Markdown code fence" in prompt
        assert "exactly these five keys and no others" in prompt
        assert "Checkout errors" in prompt
        assert "2026-08-01T00:00:00+00:00" in prompt
        assert "artifact_key" not in options
        assert "artifact_schema" not in options

    def test_start_run_includes_resolved_source_context(self) -> None:
        self.execution.input_snapshot.update(
            {
                "organizationSlug": self.organization.slug,
                "source": {
                    "type": "metric_open_period",
                    "snapshot": {
                        "analysisWindow": {
                            "breachStart": "2026-08-14T23:56:02+00:00",
                            "end": "2026-08-18T22:30:49+00:00",
                        },
                        "monitor": {
                            "name": "Mobile API error volume",
                            "query": "fixture_metric:mobile-api-errors",
                            "direction": "above",
                        },
                    },
                },
            }
        )
        self.execution.save(update_fields=["input_snapshot"])
        client = MagicMock()

        start_execution_run(self.execution, self.organization, self.user, client)

        prompt = client.start_run.call_args.args[0]
        serialized_context = prompt.split("<investigation_context>\n", 1)[1].split(
            "\n</investigation_context>", 1
        )[0]
        context = json.loads(serialized_context)
        assert context["organizationSlug"] == self.organization.slug
        assert context["source"]["snapshot"]["monitor"] == {
            "name": "Mobile API error volume",
            "query": "fixture_metric:mobile-api-errors",
            "direction": "above",
        }
        assert context["source"]["snapshot"]["analysisWindow"]["breachStart"] == (
            "2026-08-14T23:56:02+00:00"
        )

    @patch("sentry.investigations.agent.record_execution_started")
    def test_start_run_records_execution_started(self, record_started: MagicMock) -> None:
        pending_execution = self.create_investigation_block_execution(
            block=self.block,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.PENDING,
            block_version=self.block.version,
        )
        self.block.update(current_execution=pending_execution)
        client = MagicMock()

        def start_run(*args: Any, **kwargs: Any) -> Any:
            kwargs["on_run_created"](self.seer_run)
            return self.seer_run

        client.start_run.side_effect = start_run

        start_execution_run(pending_execution, self.organization, self.user, client)

        record_started.assert_called_once_with(pending_execution)

    @patch("sentry.investigations.agent.interrupt_run")
    def test_start_run_interrupts_seer_when_cancellation_wins_dispatch_race(
        self, interrupt_run: MagicMock
    ) -> None:
        pending_execution = self.create_investigation_block_execution(
            block=self.block,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.PENDING,
            block_version=self.block.version,
        )
        self.block.current_execution = pending_execution
        self.block.save(update_fields=["current_execution"])
        pending_execution.update(status=InvestigationBlockExecutionStatus.CANCELLED)
        client = MagicMock()

        def start_run(*args: Any, **kwargs: Any) -> Any:
            kwargs["on_run_created"](self.seer_run)
            return self.seer_run

        client.start_run.side_effect = start_run

        start_execution_run(pending_execution, self.organization, self.user, client)

        pending_execution.refresh_from_db()
        assert pending_execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert pending_execution.seer_run is None
        interrupt_run.assert_called_once_with(self.organization, 42)

    def test_completed_query_accepts_strict_json_final_message(self) -> None:
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="result",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content=(
                            '{"tableMarkdown":"| Errors |\\n| ---: |\\n| 12 |",'
                            '"chart":null,"preferredView":"table","isEmpty":false,'
                            '"chartUnavailableReason":"No chart was requested."}'
                        ),
                    ),
                    tool_links=[
                        ToolLink(
                            kind="telemetry",
                            params={
                                "dataset": "errors",
                                "query": "is:unresolved",
                                "project_slugs": [self.project.slug],
                            },
                        )
                    ],
                )
            ]
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert self.execution.result["tableMarkdown"].startswith("| Errors |")

    @patch("sentry.investigations.agent.record_execution_completed")
    def test_completed_execution_records_success(self, record_completed: MagicMock) -> None:
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="result",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content=(
                            '{"tableMarkdown":"| Errors |\\n| ---: |\\n| 12 |",'
                            '"chart":null,"preferredView":"table","isEmpty":false,'
                            '"chartUnavailableReason":"A chart was not requested."}'
                        ),
                    ),
                )
            ]
        )

        with self.captureOnCommitCallbacks(execute=True):
            synchronize_execution(self.execution, run_state)

        record_completed.assert_called_once()
        assert record_completed.call_args.args[0].id == self.execution.id

    @patch("sentry.investigations.telemetry.metrics.distribution")
    @patch("sentry.investigations.telemetry.sentry_sdk.metrics.distribution")
    def test_completed_execution_records_duration_metrics(
        self, sdk_distribution: MagicMock, metrics_distribution: MagicMock
    ) -> None:
        started_at = timezone.now()
        self.execution.date_added = started_at
        self.execution.completed_at = started_at + timedelta(seconds=42)

        record_execution_completed(self.execution)

        attributes = {
            "source_type": "manual",
            "template": "manual",
            "block_kind": "query",
            "executor": "code_mode",
            "outcome": "completed",
        }
        sdk_distribution.assert_called_once_with(
            "investigations.execution.duration",
            42.0,
            unit="second",
            attributes=attributes,
        )
        metrics_distribution.assert_called_once_with(
            "investigations.execution.duration",
            42.0,
            unit="second",
            tags=attributes,
            sample_rate=1.0,
        )

    def test_completed_query_rejects_prose_wrapped_json(self) -> None:
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="result",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content=(
                            "Here is the result:\n"
                            '{"tableMarkdown":"| Errors |\\n| ---: |\\n| 12 |",'
                            '"chart":null,"preferredView":"table","isEmpty":false,'
                            '"chartUnavailableReason":"No chart was requested."}'
                        ),
                    ),
                )
            ]
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.FAILED
        assert self.execution.error == {
            "code": "invalid_result",
            "message": "The agent returned malformed or unsupported result JSON.",
        }

    @patch("sentry.investigations.agent.record_investigation_failed")
    @patch("sentry.investigations.agent.record_execution_cancelled")
    @patch("sentry.investigations.agent.interrupt_run")
    def test_failed_execution_cancels_other_active_cells(
        self,
        interrupt_run: MagicMock,
        record_cancelled: MagicMock,
        record_investigation_failed: MagicMock,
    ) -> None:
        sibling_block = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            prompt="Explain the spike",
            position=1,
        )
        sibling_run = self.create_seer_run(
            organization=self.organization,
            type=SeerRunType.EXPLORER,
            seer_run_state_id=43,
        )
        sibling_execution = self.create_investigation_block_execution(
            block=sibling_block,
            seer_run=sibling_run,
            executor="text_generation",
            status=InvestigationBlockExecutionStatus.RUNNING,
            block_version=sibling_block.version,
        )
        sibling_block.current_execution = sibling_execution
        sibling_block.save(update_fields=["current_execution"])

        with self.captureOnCommitCallbacks(execute=True):
            synchronize_execution(self.execution, state(status="error", blocks=[]))

        self.execution.refresh_from_db()
        sibling_execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.FAILED
        assert sibling_execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert sibling_execution.error == {
            "code": "investigation_execution_failed",
            "message": "Cancelled because another cell in this investigation failed.",
        }
        assert sibling_execution.completed_at is not None
        record_cancelled.assert_called_once_with(
            sibling_execution, reason="investigation_execution_failed"
        )
        record_investigation_failed.assert_called_once_with(
            self.investigation, reason="seer_execution_failed"
        )
        interrupt_run.assert_called_once_with(self.organization, 43)

    @patch("sentry.investigations.telemetry.metrics.distribution")
    @patch("sentry.investigations.telemetry.sentry_sdk.metrics.distribution")
    @patch("sentry.investigations.telemetry.metrics.incr")
    @patch("sentry.investigations.telemetry.sentry_sdk.metrics.count")
    def test_failed_execution_records_metrics(
        self,
        metrics_count: MagicMock,
        metrics_incr: MagicMock,
        sdk_distribution: MagicMock,
        metrics_distribution: MagicMock,
    ) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            synchronize_execution(self.execution, state(status="error", blocks=[]))

        self.execution.refresh_from_db()
        assert self.execution.completed_at is not None
        execution_duration = (
            self.execution.completed_at - self.execution.date_added
        ).total_seconds()

        execution_attributes = {
            "reason": "seer_execution_failed",
            "source_type": "manual",
            "template": "manual",
            "block_kind": "query",
            "executor": "code_mode",
        }
        investigation_attributes = {
            "reason": "seer_execution_failed",
            "source_type": "manual",
            "template": "manual",
        }
        assert metrics_count.call_args_list == [
            (("investigations.execution.failed", 1), {"attributes": execution_attributes}),
            (("investigations.failed", 1), {"attributes": investigation_attributes}),
        ]
        assert metrics_incr.call_args_list == [
            (
                ("investigations.execution.failed",),
                {"tags": execution_attributes, "sample_rate": 1.0},
            ),
            (
                ("investigations.failed",),
                {"tags": investigation_attributes, "sample_rate": 1.0},
            ),
        ]
        duration_attributes = {
            "source_type": "manual",
            "template": "manual",
            "block_kind": "query",
            "executor": "code_mode",
            "outcome": "failed",
        }
        sdk_distribution.assert_called_once_with(
            "investigations.execution.duration",
            execution_duration,
            unit="second",
            attributes=duration_attributes,
        )
        metrics_distribution.assert_called_once_with(
            "investigations.execution.duration",
            execution_duration,
            unit="second",
            tags=duration_attributes,
            sample_rate=1.0,
        )

    @patch("sentry.investigations.agent.record_investigation_failed")
    @patch("sentry.investigations.agent.interrupt_run")
    def test_superseded_execution_failure_does_not_cancel_current_run(
        self, interrupt_run: MagicMock, record_investigation_failed: MagicMock
    ) -> None:
        current_run = self.create_seer_run(
            organization=self.organization,
            type=SeerRunType.EXPLORER,
            seer_run_state_id=43,
        )
        current_execution = self.create_investigation_block_execution(
            block=self.block,
            seer_run=current_run,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.RUNNING,
            block_version=self.block.version,
        )
        self.block.current_execution = current_execution
        self.block.save(update_fields=["current_execution"])

        with self.captureOnCommitCallbacks(execute=True):
            synchronize_execution(self.execution, state(status="error", blocks=[]))

        self.execution.refresh_from_db()
        current_execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.FAILED
        assert current_execution.status == InvestigationBlockExecutionStatus.RUNNING
        record_investigation_failed.assert_not_called()
        interrupt_run.assert_not_called()

    @patch("sentry.investigations.agent.interrupt_run")
    def test_old_block_version_failure_does_not_cancel_other_runs(
        self, interrupt_run: MagicMock
    ) -> None:
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
        self.block.version += 1
        self.block.save(update_fields=["version"])

        with self.captureOnCommitCallbacks(execute=True):
            synchronize_execution(self.execution, state(status="error", blocks=[]))

        self.execution.refresh_from_db()
        sibling_execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.FAILED
        assert sibling_execution.status == InvestigationBlockExecutionStatus.RUNNING
        interrupt_run.assert_not_called()

    @patch("sentry.investigations.agent.interrupt_run")
    def test_pending_disallowed_import_waits_for_code_mode_lint(
        self, interrupt_run: MagicMock
    ) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="pending-import",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"from sentry_sdk import ChartSeries"}',
                            )
                        ],
                    ),
                )
            ],
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.RUNNING
        interrupt_run.assert_not_called()

    @patch("sentry.investigations.agent.interrupt_run")
    def test_unsupported_execute_is_redacted_and_stopped(self, interrupt_run: MagicMock) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="unsafe",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"sentry.get_issue(issue_id=1)"}',
                            )
                        ],
                    ),
                    tool_results=[
                        ToolResult(
                            tool_call_id="call",
                            tool_call_function="sentry_api_execute",
                            content="sensitive result",
                        )
                    ],
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state)
        assert off_policy is True
        assert blocks[0]["toolResults"][0]["content"].startswith("[Result hidden")

        with self.captureOnCommitCallbacks(execute=True):
            synchronize_execution(self.execution, run_state)
        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.FAILED
        assert self.execution.error["code"] == "unsupported_tool_use"
        interrupt_run.assert_called_once()

    @patch("sentry.investigations.agent.interrupt_run", side_effect=RuntimeError("unavailable"))
    def test_unsupported_execute_stays_failed_when_interrupt_fails(
        self, interrupt_run: MagicMock
    ) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="unsafe",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"sentry.get_issue(issue_id=1)"}',
                            )
                        ],
                    ),
                )
            ],
        )

        with self.captureOnCommitCallbacks(execute=True):
            synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.FAILED
        assert self.execution.error["code"] == "unsupported_tool_use"
        interrupt_run.assert_called_once_with(self.organization, 42)

    @patch("sentry.investigations.agent.interrupt_run")
    def test_a_terminal_execution_is_never_rewritten(self, interrupt_run: MagicMock) -> None:
        # A cancelled run must keep the outcome the user asked for, even when Seer later
        # reports a still-processing state that breaks the tool policy.
        self.execution.update(status=InvestigationBlockExecutionStatus.CANCELLED)
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="unsafe",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"sentry.get_issue(issue_id=1)"}',
                            )
                        ],
                    ),
                )
            ],
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert self.execution.error is None
        interrupt_run.assert_not_called()

    def test_text_mode_rejects_and_hides_tool_results(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="tool",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[ToolCall(id="call", function="search_issues", args="{}")],
                    ),
                    tool_results=[
                        ToolResult(
                            tool_call_id="call",
                            tool_call_function="search_issues",
                            content="private issue data",
                        )
                    ],
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state, allow_query_tools=False)

        assert off_policy is True
        assert blocks[0]["toolResults"][0]["content"].startswith("[Result hidden")

    def test_query_mode_allows_sentry_api_search_for_tool_discovery(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="search",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_search",
                                args='{"code":"[skill for skill in skills if skill[0] == '
                                "'errors-search']\"}",
                            )
                        ],
                    ),
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state)

        assert off_policy is False
        assert "policyError" not in blocks[0]

    def test_result_writer_is_not_an_allowed_sentry_api(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="artifact",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"sentry.write_investigation_query_result()"}',
                            )
                        ],
                    ),
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state)

        assert off_policy is True
        assert blocks[0]["policyError"] == (
            "Unsupported Sentry API call: sentry.write_investigation_query_result."
        )

    def test_sentry_api_alias_is_rejected(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="alias",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"client = sentry\\nclient.get_issue(issue_id=1)"}',
                            )
                        ],
                    ),
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state)

        assert off_policy is True
        assert blocks[0]["policyError"] == (
            "Dynamic or aliased access to the Sentry API is unsupported."
        )

    def test_dynamic_import_is_rejected(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="dynamic-import",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"client = __import__(\\"sentry\\")"}',
                            )
                        ],
                    ),
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state)

        assert off_policy is True
        assert blocks[0]["policyError"] == (
            "The __import__ function is not allowed in an investigation query."
        )

    def test_nonexecuted_lint_failure_does_not_trigger_policy(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="lint-failure",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args='{"code":"from sentry_sdk import ChartSeries"}',
                            )
                        ],
                    ),
                    tool_results=[
                        ToolResult(
                            tool_call_id="call",
                            tool_call_function="sentry_api_execute",
                            content=(
                                "Error executing code:\n"
                                "Lint errors (code not executed):\n"
                                "  Line 1: Cannot import 'sentry_sdk'."
                            ),
                        )
                    ],
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state)

        assert off_policy is False
        assert "policyError" not in blocks[0]
        assert "Lint errors (code not executed)" in blocks[0]["toolResults"][0]["content"]

    def test_telemetry_call_cannot_escape_the_project_scope(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="other-project",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args=json.dumps(
                                    {
                                        "code": (
                                            "sentry.telemetry_live_search("
                                            "'errors', 'errors', project_slugs=['other'])"
                                        )
                                    }
                                ),
                            )
                        ],
                    ),
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state, allowed_project_slugs={self.project.slug})

        assert off_policy is True
        assert blocks[0]["policyError"] == (
            "The telemetry call requested a project outside this investigation."
        )

    def test_empty_project_slugs_cannot_widen_the_scope(self) -> None:
        # An empty list reaches the telemetry tools as "no scope supplied", which
        # makes them query every project in the organization.
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="no-project",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args=json.dumps(
                                    {
                                        "code": (
                                            "sentry.telemetry_live_search("
                                            "'errors', 'errors', project_slugs=[])"
                                        )
                                    }
                                ),
                            )
                        ],
                    ),
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state, allowed_project_slugs={self.project.slug})

        assert off_policy is True
        assert blocks[0]["policyError"] == (
            "Telemetry calls must use a non-empty literal project_slugs list."
        )

    def test_non_object_tool_call_args_are_rejected_without_crashing(self) -> None:
        run_state = state(
            status="processing",
            blocks=[
                MemoryBlock(
                    id="bad-args",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(id="call", function="sentry_api_execute", args="null")
                        ],
                    ),
                )
            ],
        )

        blocks, _, off_policy = sanitize_state(run_state, allowed_project_slugs={self.project.slug})

        assert off_policy is True
        assert blocks[0]["policyError"] == "The Code Mode call had invalid arguments."

    def test_query_links_drop_nested_and_oversized_params(self) -> None:
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="query",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="tool_use",
                        tool_calls=[
                            ToolCall(
                                id="call",
                                function="sentry_api_execute",
                                args=json.dumps(
                                    {
                                        "code": (
                                            "sentry.telemetry_live_search("
                                            "'count errors', 'errors', "
                                            f"project_slugs=['{self.project.slug}'])"
                                        )
                                    }
                                ),
                            )
                        ],
                    ),
                    tool_results=[
                        ToolResult(
                            tool_call_id="call",
                            tool_call_function="sentry_api_execute",
                            structuredContent={
                                "links": [
                                    {
                                        "kind": "telemetry",
                                        "smuggled": "top-level",
                                        "params": {
                                            "dataset": "errors",
                                            "query": "x" * 3000,
                                            "project_slugs": [self.project.slug],
                                            "nested": {"secret": "value"},
                                        },
                                    }
                                ]
                            },
                        )
                    ],
                ),
                MemoryBlock(
                    id="result",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content=(
                            '{"tableMarkdown":"| Errors |\\n| ---: |\\n| 12 |",'
                            '"chart":null,"preferredView":"table","isEmpty":false,'
                            '"chartUnavailableReason":"A chart is not useful."}'
                        ),
                    ),
                ),
            ]
        )

        synchronize_execution(self.execution, run_state)

        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.COMPLETED
        link = self.execution.result["queryLinks"][0]
        assert set(link) == {"kind", "params"}
        assert set(link["params"]) == {"dataset", "query", "project_slugs"}
        assert len(link["params"]["query"]) == 2000

    @patch("sentry.investigations.agent.record_investigation_completed")
    @patch("sentry.investigations.agent.record_title_generation_completed")
    def test_title_uses_the_final_assistant_message(
        self, record_title_completed: MagicMock, record_investigation_completed: MagicMock
    ) -> None:
        self.investigation.title = "Untitled investigation"
        self.investigation.title_generation_status = "running"
        self.investigation.save(update_fields=["title", "title_generation_status"])
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="title",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(role="assistant", content=completion_metadata()),
                )
            ]
        )

        synchronize_title(self.investigation, run_state)

        self.investigation.refresh_from_db()
        assert self.investigation.title == "Daily error volume spike"
        assert self.investigation.summary == "Error volume crossed threshold"
        assert self.investigation.summary_description == (
            "One endpoint drove most errors.\nRoll back the latest endpoint change."
        )
        assert self.investigation.title_generation_status == "completed"
        record_title_completed.assert_called_once_with(self.investigation)
        record_investigation_completed.assert_called_once_with(self.investigation)

    @patch("sentry.investigations.telemetry.metrics.distribution")
    @patch("sentry.investigations.telemetry.sentry_sdk.metrics.distribution")
    def test_completed_investigation_records_duration_metrics(
        self, sdk_distribution: MagicMock, metrics_distribution: MagicMock
    ) -> None:
        completed_at = timezone.now()
        self.investigation.date_added = completed_at - timedelta(seconds=90)

        with patch("sentry.investigations.telemetry.timezone.now", return_value=completed_at):
            record_investigation_completed(self.investigation)

        attributes = {"source_type": "manual", "template": "manual"}
        sdk_distribution.assert_called_once_with(
            "investigations.duration",
            90.0,
            unit="second",
            attributes=attributes,
        )
        metrics_distribution.assert_called_once_with(
            "investigations.duration",
            90.0,
            unit="second",
            tags=attributes,
            sample_rate=1.0,
        )

    def test_title_accepts_metadata_in_a_json_code_fence(self) -> None:
        self.investigation.update(
            title=DEFAULT_INVESTIGATION_TITLE, title_generation_status="running"
        )
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="title",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(
                        role="assistant",
                        content=f"```json\n{completion_metadata()}\n```",
                    ),
                )
            ]
        )

        synchronize_title(self.investigation, run_state)

        self.investigation.refresh_from_db()
        assert self.investigation.title == "Daily error volume spike"
        assert self.investigation.summary == "Error volume crossed threshold"
        assert self.investigation.title_generation_status == "completed"

    @patch("sentry.investigations.telemetry.metrics.incr")
    @patch("sentry.investigations.telemetry.sentry_sdk.metrics.count")
    def test_invalid_title_records_failure_metrics(
        self, metrics_count: MagicMock, metrics_incr: MagicMock
    ) -> None:
        self.investigation.update(
            title=DEFAULT_INVESTIGATION_TITLE, title_generation_status="running"
        )
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="title",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(role="assistant", content="not json"),
                )
            ]
        )

        synchronize_title(self.investigation, run_state)

        attributes = {
            "source_type": "manual",
            "template": "manual",
            "reason": "invalid_result",
        }
        assert metrics_count.call_args_list == [
            (("investigations.title_generation.failed", 1), {"attributes": attributes}),
            (("investigations.failed", 1), {"attributes": attributes}),
        ]
        assert metrics_incr.call_args_list == [
            (
                ("investigations.title_generation.failed",),
                {"tags": attributes, "sample_rate": 1.0},
            ),
            (("investigations.failed",), {"tags": attributes, "sample_rate": 1.0}),
        ]

    @patch("sentry.investigations.agent.SeerAgentClient")
    def test_title_prompt_uses_specific_incident_source_context(
        self, mock_client: MagicMock
    ) -> None:
        self.investigation.title = "Untitled investigation"
        self.investigation.source = {
            "type": "metric_open_period",
            "ref": {},
            "snapshot": {
                "groupTitle": "Checkout errors breached 100 events",
                "project": {"slug": "checkout-api"},
                "monitor": {"name": "Checkout errors", "direction": "above"},
            },
        }
        self.investigation.save(update_fields=["title", "source"])

        _maybe_start_title_generation(self.investigation, None)

        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert "Checkout errors breached 100 events" in prompt
        assert "checkout-api" in prompt
        assert "at most 5 words" in prompt
        assert "summary_description" in prompt
        assert "casual, plain language" in prompt
        assert "1 or 2 short" in prompt
        assert "Avoid headings and jargon" in prompt

    @patch("sentry.investigations.agent.record_investigation_completed")
    @patch("sentry.investigations.agent.SeerAgentClient")
    def test_title_generation_waits_for_every_auto_run_block(
        self, mock_client: MagicMock, record_completed: MagicMock
    ) -> None:
        self.investigation.update(title=DEFAULT_INVESTIGATION_TITLE)
        self.block.update(config={"autoRun": True})

        _maybe_start_title_generation(self.investigation, None)

        mock_client.return_value.start_run.assert_not_called()

        self.execution.update(
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={"schemaVersion": 1},
        )
        self.block.update(result_execution=self.execution, stale_at=None)

        _maybe_start_title_generation(self.investigation, None)

        mock_client.return_value.start_run.assert_called_once()
        record_completed.assert_not_called()

    @patch("sentry.investigations.agent.SeerAgentClient")
    def test_title_generation_skips_an_in_flight_run(self, mock_client: MagicMock) -> None:
        self.investigation.update(
            title=DEFAULT_INVESTIGATION_TITLE, title_generation_status="running"
        )

        _maybe_start_title_generation(self.investigation, None)

        assert mock_client.return_value.start_run.call_count == 0
        self.investigation.refresh_from_db()
        assert self.investigation.title_generation_status == "running"

    @patch("sentry.investigations.agent.SeerAgentClient")
    def test_title_generation_does_not_retry_a_failed_run(self, mock_client: MagicMock) -> None:
        self.investigation.update(
            title=DEFAULT_INVESTIGATION_TITLE, title_generation_status="failed"
        )

        _maybe_start_title_generation(self.investigation, None)

        mock_client.assert_not_called()
        self.investigation.refresh_from_db()
        assert self.investigation.title_generation_status == "failed"

    @patch("sentry.investigations.agent.SeerAgentClient")
    def test_title_generation_does_not_retry_a_legacy_completed_run(
        self, mock_client: MagicMock
    ) -> None:
        self.investigation.update(
            title=DEFAULT_INVESTIGATION_TITLE,
            title_generation_status="completed",
            summary=None,
            summary_description=None,
        )

        _maybe_start_title_generation(self.investigation, None)

        mock_client.assert_not_called()

    @patch("sentry.investigations.agent.SeerAgentClient")
    def test_title_dispatch_failure_releases_the_in_flight_status(
        self, mock_client: MagicMock
    ) -> None:
        self.investigation.update(title=DEFAULT_INVESTIGATION_TITLE)

        def start_run(prompt: str, **kwargs: Any) -> None:
            kwargs["on_run_created"](self.seer_run)
            raise RuntimeError("Seer is unavailable")

        mock_client.return_value.start_run.side_effect = start_run

        with pytest.raises(RuntimeError):
            _maybe_start_title_generation(self.investigation, None)

        self.investigation.refresh_from_db()
        assert self.investigation.title_seer_run_id == self.seer_run.id
        assert self.investigation.title_generation_status == "failed"

    def test_title_increments_the_investigation_version(self) -> None:
        self.investigation.update(
            title=DEFAULT_INVESTIGATION_TITLE, title_generation_status="running"
        )
        version = self.investigation.version
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="title",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(role="assistant", content=completion_metadata()),
                )
            ]
        )

        synchronize_title(self.investigation, run_state)
        assert self.investigation.version == version + 1
        self.investigation.refresh_from_db()
        assert self.investigation.version == version + 1

    def test_title_preview_streams_partial_metadata(self) -> None:
        assert title_generation_preview('{"title":"Checkout errors above') == (
            "Checkout errors above"
        )
        assert title_generation_preview(
            '{"title":"Checkout errors above threshold today extra'
        ) == ("Checkout errors above threshold today")
