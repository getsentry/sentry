from __future__ import annotations

from typing import Any

import pytest

from sentry.issue_detection.detectors.agent_redundant_tool_calls_detector import (
    AgentRedundantToolCallsDetector,
)
from sentry.issue_detection.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.grouptype import AgentRedundantToolCallsGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.event_generators import (
    create_event,
    create_span,
    modify_span_start,
)

AGENT_SPAN_ID = "a" * 16
DOCS_RESULT = "Authentication is configured with the auth middleware. See the auth guide."


def agent_span(duration: float = 4000.0) -> dict[str, Any]:
    """The `gen_ai.invoke_agent` span the SDKs wrap a whole agent run in."""
    span = create_span(
        "gen_ai.invoke_agent",
        duration,
        "invoke_agent research-agent",
        "hash0",
        data={"gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "research-agent"},
    )
    span["span_id"] = AGENT_SPAN_ID
    return modify_span_start(span, 0)


def tool_span(
    span_id: str,
    start: float,
    tool_input: str,
    output: str = DOCS_RESULT,
    duration: float = 1000.0,
    name: str = "searchDocumentation",
    status: str = "ok",
) -> dict[str, Any]:
    """
    A `gen_ai.execute_tool` span shaped the way the SDKs emit it: the tool name always present,
    the input and output only there when `send_default_pii` is on, and the description prefixed
    with the operation.
    """
    span = create_span(
        "gen_ai.execute_tool",
        duration,
        f"execute_tool {name}",
        "hash1",
        data={
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": name,
            "gen_ai.tool.input": tool_input,
            "gen_ai.tool.output": output,
        },
    )
    span["span_id"] = span_id
    span["status"] = status
    return modify_span_start(span, start)


def model_span(span_id: str, start: float, duration: float = 200.0) -> dict[str, Any]:
    span = create_span(
        "gen_ai.chat",
        duration,
        "chat gpt-4o",
        "hash2",
        data={
            "gen_ai.request.model": "gpt-4o",
            "gen_ai.usage.input_tokens": 1800,
            "gen_ai.usage.output_tokens": 200,
            "gen_ai.usage.total_tokens": 2000,
        },
    )
    span["span_id"] = span_id
    return modify_span_start(span, start)


@pytest.mark.django_db
class AgentRedundantToolCallsDetectorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._settings = get_detection_settings()

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = AgentRedundantToolCallsDetector(
            self._settings[AgentRedundantToolCallsDetector.settings_key], event
        )
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_detects_a_tool_loop_that_returns_the_same_documents(self) -> None:
        spans = [
            agent_span(),
            model_span("b" * 16, 0),
            tool_span("c" * 16, 200, '{"query": "how do I configure auth"}'),
            model_span("d" * 16, 1200),
            tool_span("e" * 16, 1400, '{"query": "how do I configure auth"}'),
            model_span("f" * 16, 2400),
            tool_span("1" * 16, 2600, '{"query": "how do I configure auth"}'),
        ]

        problems = self.find_problems(create_event(spans))
        assert len(problems) == 1
        problem = problems[0]

        assert problem.type == AgentRedundantToolCallsGroupType
        assert problem.op == "gen_ai.execute_tool"
        assert problem.desc == "searchDocumentation called 3 times with equivalent arguments"
        assert problem.offender_span_ids == ["c" * 16, "e" * 16, "1" * 16]
        # The tool spans hang off the agent span, which is what the issue points at.
        assert problem.parent_span_ids == [AGENT_SPAN_ID]

        assert problem.evidence_data is not None
        assert problem.evidence_data["tool_name"] == "searchDocumentation"
        assert problem.evidence_data["num_redundant_calls"] == 3
        assert problem.evidence_data["redundant_call_duration"] == 3000
        assert problem.evidence_data["result_similarity_ratio"] == 1.0
        # The two model calls between the first and last tool call re-fed the same tool output
        # back into the model.
        assert problem.evidence_data["interleaved_model_calls"] == 2
        assert problem.evidence_data["interleaved_model_tokens"] == 4000

    def test_reports_the_share_of_the_run_the_loop_consumed(self) -> None:
        db_span = create_span("db", 2000.0, "SELECT * FROM users", "hash3")
        db_span["span_id"] = "d" * 16

        spans = [
            agent_span(duration=8000.0),
            tool_span("a1" * 8, 0, '{"query": "auth"}', duration=2000.0),
            tool_span("b" * 16, 2000, '{"query": "auth"}', duration=2000.0),
            tool_span("c" * 16, 4000, '{"query": "auth"}', duration=2000.0),
            modify_span_start(db_span, 6000),
        ]

        problems = self.find_problems(create_event(spans))
        assert len(problems) == 1
        assert problems[0].evidence_data["run_duration"] == 8000
        assert problems[0].evidence_data["redundant_duration_ratio"] == 0.75

    def test_treats_reformatted_and_recased_arguments_as_equivalent(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "Configure Auth", "limit": 5}'),
            tool_span("c" * 16, 1000, '{"limit": 5, "query": "configure auth"}'),
            tool_span("d" * 16, 2000, '{"query":"configure   auth","limit":5}'),
        ]

        assert len(self.find_problems(create_event(spans))) == 1

    def test_reads_the_alternate_tool_call_attribute_spelling(self) -> None:
        spans = [agent_span()]
        for index, span_id in enumerate(("b", "c", "d")):
            span = create_span(
                "gen_ai.execute_tool",
                1000.0,
                "execute_tool searchDocumentation",
                "hash1",
                data={
                    "gen_ai.tool.name": "searchDocumentation",
                    "gen_ai.tool.call.arguments": '{"query": "auth"}',
                    "gen_ai.tool.call.result": DOCS_RESULT,
                },
            )
            span["span_id"] = span_id * 16
            spans.append(modify_span_start(span, index * 1000))

        assert len(self.find_problems(create_event(spans))) == 1

    def test_falls_back_to_the_span_description_for_the_tool_name(self) -> None:
        spans = [agent_span()]
        for index, span_id in enumerate(("b", "c", "d")):
            span = create_span(
                "gen_ai.execute_tool",
                1000.0,
                "execute_tool searchDocumentation",
                "hash1",
                data={"gen_ai.tool.input": '{"query": "auth"}', "gen_ai.tool.output": DOCS_RESULT},
            )
            span["span_id"] = span_id * 16
            spans.append(modify_span_start(span, index * 1000))

        problems = self.find_problems(create_event(spans))
        assert len(problems) == 1
        assert problems[0].evidence_data["tool_name"] == "searchDocumentation"

    def test_ignores_calls_asking_different_questions(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "how do I configure auth"}'),
            tool_span("c" * 16, 1000, '{"query": "which database drivers ship by default"}'),
            tool_span("d" * 16, 2000, '{"query": "what does the rate limiter do"}'),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_ignores_repeated_calls_that_keep_returning_new_information(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}', output="the auth middleware guide"),
            tool_span("c" * 16, 1000, '{"query": "auth"}', output="oauth provider setup steps"),
            tool_span("d" * 16, 2000, '{"query": "auth"}', output="session cookie reference"),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_ignores_a_polling_loop_that_ends_on_a_changed_result(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"job": "build-42"}', output='{"status": "running"}'),
            tool_span("c" * 16, 1000, '{"job": "build-42"}', output='{"status": "running"}'),
            tool_span("d" * 16, 2000, '{"job": "build-42"}', output='{"status": "running"}'),
            tool_span("e" * 16, 3000, '{"job": "build-42"}', output='{"finished": "success"}'),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_ignores_retries_of_a_failing_tool(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}', status="internal_error"),
            tool_span("c" * 16, 1000, '{"query": "auth"}', status="internal_error"),
            tool_span("d" * 16, 2000, '{"query": "auth"}', status="internal_error"),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_counts_only_the_successful_calls_of_a_partly_failing_tool(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}', status="internal_error"),
            tool_span("c" * 16, 1000, '{"query": "auth"}'),
            tool_span("d" * 16, 2000, '{"query": "auth"}'),
            tool_span("e" * 16, 3000, '{"query": "auth"}'),
        ]

        problems = self.find_problems(create_event(spans))
        assert len(problems) == 1
        assert problems[0].evidence_data["num_redundant_calls"] == 3
        assert problems[0].offender_span_ids == ["c" * 16, "d" * 16, "e" * 16]

    def test_ignores_repeated_calls_spread_across_a_long_running_segment(self) -> None:
        spans = [
            agent_span(duration=200_000.0),
            tool_span("b" * 16, 0, '{"query": "auth"}'),
            tool_span("c" * 16, 1000, '{"query": "auth"}'),
            # Minutes later, so the agent is after fresh data rather than stuck in a loop.
            tool_span("d" * 16, 150_000, '{"query": "auth"}'),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_ignores_repeated_calls_around_a_state_change(self) -> None:
        write_span = create_span("http.client", 100.0, "POST /api/0/documents/", "hash4")
        write_span["span_id"] = "e" * 16

        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}'),
            tool_span("c" * 16, 1000, '{"query": "auth"}'),
            modify_span_start(write_span, 1500),
            tool_span("d" * 16, 2000, '{"query": "auth"}'),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_ignores_long_results_that_differ_past_a_shared_header(self) -> None:
        """
        Tool results commonly open with the same schema or preamble and only diverge further in.
        The shared header here is longer than the sample budget, so comparing openings alone
        would call these three documents identical.
        """
        header = " ".join(f"header-field-{index}" for index in range(400))
        bodies = [
            " ".join(f"{topic}-passage-{index}" for index in range(600))
            for topic in ("middleware", "oauth", "cookies")
        ]
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}', output=f"{header} {bodies[0]}"),
            tool_span("c" * 16, 1000, '{"query": "auth"}', output=f"{header} {bodies[1]}"),
            tool_span("d" * 16, 2000, '{"query": "auth"}', output=f"{header} {bodies[2]}"),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_detects_a_loop_returning_identical_long_results(self) -> None:
        document = " ".join(f"auth-guide-passage-{index}" for index in range(1000))
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}', output=document),
            tool_span("c" * 16, 1000, '{"query": "auth"}', output=document),
            tool_span("d" * 16, 2000, '{"query": "auth"}', output=document),
        ]

        problems = self.find_problems(create_event(spans))
        assert len(problems) == 1
        assert problems[0].evidence_data["result_similarity_ratio"] == 1.0

    def test_ignores_a_loop_below_the_count_threshold(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}'),
            tool_span("c" * 16, 1000, '{"query": "auth"}'),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_ignores_a_loop_of_cheap_calls(self) -> None:
        spans = [
            agent_span(),
            tool_span("b" * 16, 0, '{"query": "auth"}', duration=50.0),
            tool_span("c" * 16, 100, '{"query": "auth"}', duration=50.0),
            tool_span("d" * 16, 200, '{"query": "auth"}', duration=50.0),
        ]

        assert self.find_problems(create_event(spans)) == []

    def test_separates_loops_by_tool(self) -> None:
        spans = [
            agent_span(duration=6000.0),
            tool_span("b" * 16, 0, '{"query": "auth"}'),
            tool_span("c" * 16, 1000, '{"query": "auth"}'),
            tool_span("d" * 16, 2000, '{"query": "auth"}'),
            tool_span("e" * 16, 3000, '{"path": "src/auth.py"}', name="readFile"),
            tool_span("f" * 16, 4000, '{"path": "src/auth.py"}', name="readFile"),
            tool_span("1" * 16, 5000, '{"path": "src/auth.py"}', name="readFile"),
        ]

        problems = self.find_problems(create_event(spans))
        assert sorted(problem.evidence_data["tool_name"] for problem in problems) == [
            "readFile",
            "searchDocumentation",
        ]
        assert len({problem.fingerprint for problem in problems}) == 2

    def test_stays_silent_when_the_sdk_reports_no_tool_input(self) -> None:
        """Tool input and output are only sent with `send_default_pii`, so this is the default."""
        spans = [agent_span()]
        for index, span_id in enumerate(("b", "c", "d")):
            span = create_span(
                "gen_ai.execute_tool",
                1000.0,
                "execute_tool searchDocumentation",
                "hash1",
                data={
                    "gen_ai.operation.name": "execute_tool",
                    "gen_ai.tool.name": "searchDocumentation",
                },
            )
            span["span_id"] = span_id * 16
            spans.append(modify_span_start(span, index * 1000))

        assert self.find_problems(create_event(spans)) == []

    def test_skips_tool_input_that_cannot_be_serialized(self) -> None:
        spans = [agent_span()]
        for index, span_id in enumerate(("b", "c", "d")):
            span = create_span(
                "gen_ai.execute_tool",
                1000.0,
                "execute_tool searchDocumentation",
                "hash1",
                data={
                    "gen_ai.tool.name": "searchDocumentation",
                    "gen_ai.tool.input": object(),
                },
            )
            span["span_id"] = span_id * 16
            spans.append(modify_span_start(span, index * 1000))

        assert self.find_problems(create_event(spans)) == []

    def test_ignores_events_without_agent_spans(self) -> None:
        spans = [create_span("db", 2000.0, "SELECT * FROM users", "hash3")]

        assert self.find_problems(create_event(spans)) == []

    def test_detection_is_gated_by_the_project_setting(self) -> None:
        detector = AgentRedundantToolCallsDetector(
            {**self._settings[AgentRedundantToolCallsDetector.settings_key]}, create_event([])
        )
        assert detector.is_creation_allowed() is False

        detector.settings["detection_enabled"] = True
        assert detector.is_creation_allowed() is True
