from __future__ import annotations

import hashlib
import re
from bisect import bisect_left
from dataclasses import dataclass, field
from typing import Any

from sentry.issue_detection.base import DetectorType, PerformanceDetector
from sentry.issue_detection.detectors.utils import (
    get_notification_attachment_body,
    total_span_time,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import Span
from sentry.issues.grouptype import AgentRedundantToolCallsGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.project import Project
from sentry.utils import json

TOOL_OP = "gen_ai.execute_tool"
# `gen_ai` ops that wrap other spans rather than doing work themselves. Their duration and
# token usage already covers their children, so they're neither tool nor model calls.
AGENT_WRAPPER_OPS = frozenset(("gen_ai.invoke_agent", "gen_ai.create_agent", "gen_ai.handoff"))

# Argument/result payloads can be enormous, and this runs on every ingested event, so at most
# this many characters of one are ever inspected.
MAX_PAYLOAD_LENGTH = 4096
# Those characters are taken as evenly spaced chunks rather than as a prefix. Tool results
# routinely open with a schema, preamble, or citation block, and comparing openings alone would
# call any two results from the same tool identical.
PAYLOAD_SAMPLE_CHUNKS = 8
# Above this length a payload isn't worth trying to parse as JSON.
MAX_CANONICALIZE_LENGTH = 16_384
# Guards against pathological runs. Beyond these caps we stop clustering, which can only
# cause us to miss a problem, never to invent one.
MAX_TOOL_CALLS = 200
MAX_CLUSTERS_PER_TOOL = 20

MAX_EVIDENCE_VALUE_LENGTH = 1_000

# Two results overlapping by at least this much are treated as the same information.
RESULT_SIMILARITY_THRESHOLD = 0.8
# Once at least this share of the repeated calls returns a result overlapping the first
# call's result, the loop is considered to be making no progress.
MIN_RESULT_SIMILARITY_RATIO = 0.5
# Repeated calls further apart than this aren't a loop. An agent re-reading a tool minutes
# later is usually after fresh data, not stuck.
MAX_DURATION_BETWEEN_CALLS = 60_000  # ms

_TOKEN_SPLIT_RE = re.compile(r"[^a-z0-9]+")

# `gen_ai.tool.input`/`gen_ai.tool.output` are what the SDKs emit; the `call.arguments`/
# `call.result` spellings come from other gen_ai instrumentation and appear in the wild too.
_ARGUMENT_KEYS = ("gen_ai.tool.input", "gen_ai.tool.call.arguments")
_RESULT_KEYS = ("gen_ai.tool.output", "gen_ai.tool.call.result")
_TOKEN_USAGE_KEYS = ("gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens")

# SDKs name tool spans `execute_tool <name>`, so the description is only a fallback for the
# tool name once this prefix is removed.
_TOOL_DESCRIPTION_PREFIX = "execute_tool "

# Span statuses that don't indicate the tool failed. Anything else means the agent was
# retrying after an error, which is not the same problem as a redundant loop.
_NON_ERROR_STATUSES = frozenset(("ok", "unknown", "unset", ""))

# Spans that likely changed state the agent can observe, which makes repeating a tool call
# with the same arguments a reasonable thing to do.
_MUTATING_HTTP_METHODS = ("POST", "PUT", "PATCH", "DELETE")
_MUTATING_DB_KEYWORDS = ("INSERT", "UPDATE", "DELETE", "REPLACE", "UPSERT", "MERGE")


@dataclass
class ToolCall:
    span: Span
    name: str
    argument_tokens: frozenset[str]
    arguments: str
    result_tokens: frozenset[str]


@dataclass
class ModelCall:
    start_timestamp: float
    tokens: int


@dataclass
class ToolCallCluster:
    """
    Repeated calls to one tool whose arguments are all equivalent to the first call's, ordered
    by start time.
    """

    calls: list[ToolCall] = field(default_factory=list)

    @property
    def name(self) -> str:
        return self.calls[0].name

    @property
    def start_timestamp(self) -> float:
        return self.calls[0].span.get("start_timestamp", 0)

    @property
    def end_timestamp(self) -> float:
        return max(call.span.get("timestamp", 0) for call in self.calls)

    def sort_calls(self) -> None:
        self.calls.sort(key=lambda call: call.span.get("start_timestamp", 0))

    def max_gap_between_calls(self) -> float:
        """Largest gap in ms between the end of one call and the start of the next."""
        gaps = [
            self.calls[index].span.get("start_timestamp", 0)
            - self.calls[index - 1].span.get("timestamp", 0)
            for index in range(1, len(self.calls))
        ]
        return max(gaps, default=0.0) * 1000

    def result_similarity_ratio(self) -> float:
        """
        The share of repeat calls whose result overlaps the first call's result. Returns 0 when
        results weren't recorded, so callers must treat missing results separately.
        """
        first, *repeats = self.calls
        if not first.result_tokens:
            return 0.0

        overlapping = sum(
            1
            for call in repeats
            if call.result_tokens
            and _jaccard_similarity(first.result_tokens, call.result_tokens)
            >= RESULT_SIMILARITY_THRESHOLD
        )
        return overlapping / len(repeats)

    def last_call_returned_new_information(self) -> bool:
        """
        Whether the loop ended on a result the first call didn't already have. A polling tool
        looks identical to a redundant one until its last call comes back changed, which is
        exactly the agent making progress and waiting correctly.
        """
        first, last = self.calls[0], self.calls[-1]
        if not first.result_tokens or not last.result_tokens:
            return False
        return (
            _jaccard_similarity(first.result_tokens, last.result_tokens)
            < RESULT_SIMILARITY_THRESHOLD
        )

    def has_results(self) -> bool:
        return any(call.result_tokens for call in self.calls)


class AgentRedundantToolCallsDetector(PerformanceDetector):
    """
    Detects an agent burning latency and tokens by calling the same tool over and over without
    learning anything new.

    A problem is reported when all of the following hold for one tool:
      - it succeeded at least `count_threshold` times with equivalent arguments,
      - those calls took at least `total_duration_threshold` in aggregate,
      - no two consecutive calls were more than `MAX_DURATION_BETWEEN_CALLS` apart,
      - the calls returned overlapping results, including the last one (when results were
        recorded),
      - nothing between the first and last call changed state the agent could observe.

    Requires the tool's arguments, which SDKs only send when `send_default_pii` is enabled, so
    this stays silent for agents that don't report them.
    """

    type = DetectorType.AGENT_REDUNDANT_TOOL_CALLS
    settings_key = DetectorType.AGENT_REDUNDANT_TOOL_CALLS

    def __init__(
        self,
        settings: dict[str, Any],
        event: dict[str, Any],
        detector_id: int | None = None,
    ) -> None:
        super().__init__(settings, event, detector_id)

        self.tool_calls: list[ToolCall] = []
        self.model_calls: list[ModelCall] = []
        # Sorted in `on_complete`; spans are visited in tree order, not time order.
        self.mutation_timestamps: list[float] = []
        self.run_start_timestamp: float | None = None
        self.run_end_timestamp: float | None = None

    @classmethod
    def is_event_eligible(cls, event: dict[str, Any], project: Project | None = None) -> bool:
        return any(
            (span.get("op") or "").startswith("gen_ai.") for span in event.get("spans") or []
        )

    def visit_span(self, span: Span) -> None:
        self._track_run_bounds(span)

        op = span.get("op") or ""
        if op == TOOL_OP:
            self._visit_tool_span(span)
        elif op.startswith("gen_ai.") and op not in AGENT_WRAPPER_OPS:
            self.model_calls.append(
                ModelCall(
                    start_timestamp=span.get("start_timestamp", 0),
                    tokens=_get_token_usage(span),
                )
            )
        elif _is_mutating_span(span):
            self.mutation_timestamps.append(span.get("start_timestamp", 0))

    def on_complete(self) -> None:
        self.mutation_timestamps.sort()
        for cluster in self._cluster_tool_calls():
            self._maybe_store_problem(cluster)

    def is_creation_allowed(self) -> bool:
        return self.settings["detection_enabled"]

    def _track_run_bounds(self, span: Span) -> None:
        start = span.get("start_timestamp", 0)
        end = span.get("timestamp", 0)
        if self.run_start_timestamp is None or start < self.run_start_timestamp:
            self.run_start_timestamp = start
        if self.run_end_timestamp is None or end > self.run_end_timestamp:
            self.run_end_timestamp = end

    def _visit_tool_span(self, span: Span) -> None:
        if len(self.tool_calls) >= MAX_TOOL_CALLS:
            return

        if (span.get("status") or "").lower() not in _NON_ERROR_STATUSES:
            # The agent was retrying a failing tool. Repeating a call that errored is a
            # different problem, and treating it as a loop would blame the wrong thing.
            return

        data = span.get("data") or {}
        name = data.get("gen_ai.tool.name") or _name_from_description(span)
        arguments = _first_string(data, _ARGUMENT_KEYS)
        if not name or not arguments:
            # Without a tool name and arguments there's nothing to compare calls on.
            return

        self.tool_calls.append(
            ToolCall(
                span=span,
                name=str(name),
                argument_tokens=_tokenize(_canonicalize(arguments)),
                arguments=arguments[:MAX_EVIDENCE_VALUE_LENGTH],
                result_tokens=_tokenize(_first_string(data, _RESULT_KEYS)),
            )
        )

    def _cluster_tool_calls(self) -> list[ToolCallCluster]:
        """
        Group calls by tool name, then greedily cluster them by argument similarity. The first
        call in a cluster is the representative, so a cluster means "these calls all asked the
        same question", not "these calls resemble each other transitively".
        """
        clusters_by_tool: dict[str, list[ToolCallCluster]] = {}
        similarity_threshold = self.settings["argument_similarity_threshold"]

        for call in self.tool_calls:
            clusters = clusters_by_tool.setdefault(call.name, [])
            for cluster in clusters:
                if (
                    _jaccard_similarity(cluster.calls[0].argument_tokens, call.argument_tokens)
                    >= similarity_threshold
                ):
                    cluster.calls.append(call)
                    break
            else:
                if len(clusters) < MAX_CLUSTERS_PER_TOOL:
                    clusters.append(ToolCallCluster(calls=[call]))

        clusters = [cluster for clusters in clusters_by_tool.values() for cluster in clusters]
        for cluster in clusters:
            cluster.sort_calls()
        return clusters

    def _maybe_store_problem(self, cluster: ToolCallCluster) -> None:
        if len(cluster.calls) < self.settings["count_threshold"]:
            return

        spans = [call.span for call in cluster.calls]
        duplicate_duration = total_span_time(spans)
        if duplicate_duration < self.settings["total_duration_threshold"]:
            return

        if cluster.max_gap_between_calls() > MAX_DURATION_BETWEEN_CALLS:
            return

        # When results were recorded, they have to actually overlap, and the loop has to end
        # without turning anything up. Repeated calls that keep returning something different,
        # or that end on a changed result, are gathering information rather than spinning.
        result_similarity = cluster.result_similarity_ratio()
        if cluster.has_results() and (
            result_similarity < MIN_RESULT_SIMILARITY_RATIO
            or cluster.last_call_returned_new_information()
        ):
            return

        if self._state_changed_during(cluster):
            return

        fingerprint = self._fingerprint(cluster.name)
        offender_span_ids = [span["span_id"] for span in spans]
        interleaved_model_calls, interleaved_tokens = self._model_usage_during(cluster)
        run_duration = self._run_duration()

        evidence_data: dict[str, Any] = {
            "op": TOOL_OP,
            "cause_span_ids": [],
            "parent_span_ids": _parent_span_ids(spans),
            "offender_span_ids": offender_span_ids,
            "transaction_name": self._event.get("transaction", ""),
            "tool_name": cluster.name,
            "num_redundant_calls": len(cluster.calls),
            "redundant_call_duration": duplicate_duration,
            "run_duration": run_duration,
            # How much of the run these calls account for. The most useful number for deciding
            # whether the loop is worth fixing.
            "redundant_duration_ratio": (
                duplicate_duration / run_duration if run_duration else None
            ),
            # Model/tool cycles: each interleaved model call re-fed the same tool output back
            # into the model.
            "interleaved_model_calls": interleaved_model_calls,
            "interleaved_model_tokens": interleaved_tokens,
            "result_similarity_ratio": result_similarity if cluster.has_results() else None,
            "sample_arguments": cluster.calls[0].arguments[:MAX_EVIDENCE_VALUE_LENGTH],
        }
        if self.detector_id is not None:
            evidence_data["detector_id"] = self.detector_id

        desc = f"{cluster.name} called {len(cluster.calls)} times with equivalent arguments"

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint=fingerprint,
            op=TOOL_OP,
            desc=desc,
            type=AgentRedundantToolCallsGroupType,
            cause_span_ids=[],
            parent_span_ids=evidence_data["parent_span_ids"],
            offender_span_ids=offender_span_ids,
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(TOOL_OP, desc)[
                        :MAX_EVIDENCE_VALUE_LENGTH
                    ],
                    # Has to be marked important to be displayed in the notifications
                    important=True,
                )
            ],
            evidence_data=evidence_data,
        )

    def _state_changed_during(self, cluster: ToolCallCluster) -> bool:
        start, end = cluster.start_timestamp, cluster.end_timestamp
        index = bisect_left(self.mutation_timestamps, start)
        return index < len(self.mutation_timestamps) and self.mutation_timestamps[index] <= end

    def _model_usage_during(self, cluster: ToolCallCluster) -> tuple[int, int]:
        start, end = cluster.start_timestamp, cluster.end_timestamp
        interleaved = [
            model_call
            for model_call in self.model_calls
            if start <= model_call.start_timestamp <= end
        ]
        return len(interleaved), sum(model_call.tokens for model_call in interleaved)

    def _run_duration(self) -> float:
        if self.run_start_timestamp is None or self.run_end_timestamp is None:
            return 0.0
        return (self.run_end_timestamp - self.run_start_timestamp) * 1000

    def _fingerprint(self, tool_name: str) -> str:
        # Fingerprint on the tool, not the arguments: the fix is to the tool or the loop around
        # it, and arguments carry user input, which would shatter the issue into one group per
        # distinct question the agent was asked.
        signature = hashlib.sha1(tool_name.encode("utf-8")).hexdigest()
        return f"1-{AgentRedundantToolCallsGroupType.type_id}-{signature}"


def _first_string(data: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
        if value is not None and not isinstance(value, str):
            # Some SDKs attach the raw object rather than a serialized payload.
            try:
                return json.dumps(value)
            except Exception:
                # Nothing comparable to work with, so the call is skipped.
                return ""
    return ""


def _canonicalize(arguments: str) -> str:
    """
    Reduce an argument payload to a form where irrelevant differences (key order, formatting)
    disappear. Semantic equivalence beyond that is left to token comparison.
    """
    if len(arguments) > MAX_CANONICALIZE_LENGTH:
        return arguments
    try:
        parsed = json.loads(arguments)
    except Exception:
        return arguments
    try:
        return json.dumps(parsed, sort_keys=True)
    except Exception:
        return arguments


def _sample_payload(payload: str) -> str:
    """
    Bound a payload to `MAX_PAYLOAD_LENGTH` characters taken as evenly spaced chunks, so that
    the middle and tail of a long result weigh as much as its opening.
    """
    if len(payload) <= MAX_PAYLOAD_LENGTH:
        return payload

    chunk_length = MAX_PAYLOAD_LENGTH // PAYLOAD_SAMPLE_CHUNKS
    stride = len(payload) // PAYLOAD_SAMPLE_CHUNKS
    return "".join(
        payload[index * stride : index * stride + chunk_length]
        for index in range(PAYLOAD_SAMPLE_CHUNKS)
    )


def _tokenize(payload: str) -> frozenset[str]:
    if not payload:
        return frozenset()
    return frozenset(
        token for token in _TOKEN_SPLIT_RE.split(_sample_payload(payload).lower()) if token
    )


def _name_from_description(span: Span) -> str:
    description = (span.get("description") or "").strip()
    if description.startswith(_TOOL_DESCRIPTION_PREFIX):
        return description[len(_TOOL_DESCRIPTION_PREFIX) :]
    return description


def _jaccard_similarity(left: frozenset[str], right: frozenset[str]) -> float:
    if not left or not right:
        return 0.0
    union = len(left | right)
    return len(left & right) / union if union else 0.0


def _get_token_usage(span: Span) -> int:
    data = span.get("data") or {}
    total = data.get("gen_ai.usage.total_tokens")
    if isinstance(total, (int, float)):
        return int(total)

    tokens = 0
    for key in _TOKEN_USAGE_KEYS:
        value = data.get(key)
        if isinstance(value, (int, float)):
            tokens += int(value)
    return tokens


def _is_mutating_span(span: Span) -> bool:
    op = span.get("op") or ""
    description = (span.get("description") or "").strip().upper()
    if not description:
        return False

    if op.startswith("http.client"):
        return description.startswith(_MUTATING_HTTP_METHODS)
    if op.startswith("db") and not op.startswith("db.redis"):
        return description.startswith(_MUTATING_DB_KEYWORDS)
    return False


def _parent_span_ids(spans: list[Span]) -> list[str]:
    """The agent span(s) the repeated calls hang off of, when the SDK recorded a parent."""
    parent_ids = []
    for span in spans:
        parent_id = span.get("parent_span_id")
        if parent_id and parent_id not in parent_ids:
            parent_ids.append(parent_id)
    return parent_ids
