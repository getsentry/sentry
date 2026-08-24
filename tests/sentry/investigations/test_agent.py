from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.investigations.agent import (
    _maybe_start_title_generation,
    sanitize_state,
    start_execution_run,
    synchronize_execution,
    synchronize_title,
)
from sentry.investigations.models import InvestigationBlockExecutionStatus
from sentry.investigations.services.investigations import DEFAULT_INVESTIGATION_TITLE
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

    def test_start_run_requests_a_final_response_without_an_artifact_writer(self) -> None:
        client = MagicMock()

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
        assert "first character must be { and the last character must be }" in prompt
        assert "Do not wrap the object in a Markdown code fence" in prompt
        assert "exactly these five keys and no others" in prompt
        assert "artifact_key" not in options
        assert "artifact_schema" not in options

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

        synchronize_execution(self.execution, run_state)
        self.execution.refresh_from_db()
        assert self.execution.status == InvestigationBlockExecutionStatus.FAILED
        assert self.execution.error["code"] == "unsupported_tool_use"
        interrupt_run.assert_called_once()

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

    def test_title_uses_the_final_assistant_message(self) -> None:
        self.investigation.title = "Untitled investigation"
        self.investigation.title_generation_status = "running"
        self.investigation.save(update_fields=["title", "title_generation_status"])
        run_state = state(
            blocks=[
                MemoryBlock(
                    id="title",
                    timestamp="2026-08-03T00:00:00Z",
                    message=Message(role="assistant", content="Daily error volume by project"),
                )
            ]
        )

        synchronize_title(self.investigation, run_state)

        self.investigation.refresh_from_db()
        assert self.investigation.title == "Daily error volume by project"
        assert self.investigation.title_generation_status == "completed"

    @patch("sentry.investigations.agent.SeerAgentClient")
    def test_title_prompt_uses_specific_incident_source_context(
        self, mock_client: MagicMock
    ) -> None:
        self.investigation.title = "Untitled investigation"
        self.investigation.source_ref = {
            "groupTitle": "Checkout errors breached 100 events",
            "project": {"slug": "checkout-api"},
            "monitor": {"name": "Checkout errors", "direction": "above"},
        }
        self.investigation.save(update_fields=["title", "source_ref"])

        _maybe_start_title_generation(self.investigation, None)

        prompt = mock_client.return_value.start_run.call_args.args[0]
        assert "specific incident" in prompt
        assert "Checkout errors breached 100 events" in prompt
        assert "checkout-api" in prompt
        assert "Avoid generic titles" in prompt

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
                    message=Message(role="assistant", content="Checkout errors above threshold"),
                )
            ]
        )

        synchronize_title(self.investigation, run_state)
        assert self.investigation.version == version + 1
        self.investigation.refresh_from_db()
        assert self.investigation.version == version + 1
