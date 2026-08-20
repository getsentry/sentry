"""End-to-end coverage against a real Snuba EAP instance.

The unit tests mock the query layer out, so nothing else exercises the search
grammar filter, the EAP attribute names, or the aggregation itself -- the parts
that fail silently as "no findings" rather than as an error.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

from sentry.issues.grouptype import LLMCacheUsageGroupType
from sentry.llm_cache_detection.detection import (
    AgentLabelSource,
    CallSiteStats,
    DetectionWindow,
)
from sentry.llm_cache_detection.query import (
    PROMPT_SAMPLES_LIMIT,
    count_spans_with_cache_attributes,
    fetch_call_site_stats,
    fetch_call_site_warmth,
    fetch_sample_calls,
    fetch_sample_prompts,
)
from sentry.models.project import Project
from sentry.tasks.llm_cache_issue_detection import (
    detect_llm_cache_issues_for_project,
    run_llm_cache_issue_detection,
)
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.task_runner import TaskRunner

DETECTION_FEATURE = "organizations:llm-cache-detection"
INGEST_FEATURE = LLMCacheUsageGroupType.build_ingest_feature_name()

# Above MIN_AVG_INPUT_TOKENS so eligibility turns purely on the call count,
# which each test lowers to keep the seeded span volume small.
INPUT_TOKENS = 2_000
CALLS_PER_CALL_SITE = 6

# Synthetic, invented for the test. Real prompt text never goes in a fixture.
PROMPT = '[{"role": "system", "content": "Rank the rows and explain the ranking."}]'

CLAUDE = "claude-sonnet-4"
# Gemini reports cache attributes only when positive, which is what lets a call
# site be flagged without the instrumentation-gap probe.
GEMINI = "gemini-2.5-pro"


class LLMCacheDetectionIntegrationTest(TestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)
        self.window = DetectionWindow.ending_now()

    def gen_ai_span(
        self,
        *,
        transaction: str = "/chat",
        span_name: str = "generate_content claude",
        agent_name: str | None = None,
        model: str = CLAUDE,
        input_tokens: int = INPUT_TOKENS,
        cache_read_tokens: int | None = None,
        cache_creation_tokens: int | None = None,
        op: str = "gen_ai.chat",
        operation_type: str | None = "ai_client",
        operation_name: str | None = "generate_content",
        project: Project | None = None,
        deprecated_attribute_names: bool = False,
        prompt: str | None = None,
        start_ts: datetime | None = None,
    ) -> dict[str, Any]:
        """Build a gen-AI call span. Omitted token kwargs are left off the span entirely.

        ``gen_ai.operation.type`` is normally added during ingestion from the op;
        these spans are written straight to EAP, so it is set explicitly here.
        The name is written to the description as well, which is how gen-AI call
        spans arrive in practice.

        ``agent_name`` defaults to absent: plenty of SDK paths never emit one,
        and that is the case the operation-name fallback exists for.
        """
        read_attribute, creation_attribute = (
            ("gen_ai.usage.input_tokens.cached", "gen_ai.usage.input_tokens.cache_write")
            if deprecated_attribute_names
            else (
                "gen_ai.usage.cache_read.input_tokens",
                "gen_ai.usage.cache_creation.input_tokens",
            )
        )
        data: dict[str, Any] = {
            "gen_ai.request.model": model,
            "gen_ai.usage.input_tokens": input_tokens,
        }
        if operation_type is not None:
            data["gen_ai.operation.type"] = operation_type
        if operation_name is not None:
            data["gen_ai.operation.name"] = operation_name
        if agent_name is not None:
            data["gen_ai.agent.name"] = agent_name
        if cache_read_tokens is not None:
            data[read_attribute] = cache_read_tokens
        if cache_creation_tokens is not None:
            data[creation_attribute] = cache_creation_tokens
        if prompt is not None:
            prompt_attribute = (
                "gen_ai.request.messages" if deprecated_attribute_names else "gen_ai.input.messages"
            )
            data[prompt_attribute] = prompt

        return self.create_span(
            project=project or self.project,
            extra_data={
                "description": span_name,
                "sentry_tags": {"op": op, "transaction": transaction, "name": span_name},
                "data": data,
            },
            start_ts=start_ts or self.ten_mins_ago,
        )

    def store_call_site(self, *, count: int = CALLS_PER_CALL_SITE, **kwargs: Any) -> None:
        self.store_spans([self.gen_ai_span(**kwargs) for _ in range(count)])

    def stats_for(self, stats: list[CallSiteStats], model: str) -> CallSiteStats:
        matching = [entry for entry in stats if entry.model == model]
        assert len(matching) == 1, f"expected exactly one {model} call site, got {matching}"
        return matching[0]


class FetchCallSiteStatsTest(LLMCacheDetectionIntegrationTest):
    def test_counts_stored_spans_alongside_the_traffic_they_stand_for(self) -> None:
        # The evidence floor is read off the stored-span count, so it has to
        # arrive from EAP rather than default to zero -- which would classify
        # every call site as ineligible and look exactly like no traffic.
        self.store_call_site(agent_name="Explorer", model=GEMINI)

        [call_site] = fetch_call_site_stats(self.project, self.window)

        assert call_site.call_count == CALLS_PER_CALL_SITE
        # Nothing sampled these away, so the two counts agree.
        assert call_site.sampled_call_count == CALLS_PER_CALL_SITE

    def test_separates_two_agents_sharing_a_span_name_and_model(self) -> None:
        # The span name is the SDK wrapper both agents call through. Keying on it
        # alone would average a broken call site into a healthy one and report
        # neither.
        self.store_call_site(
            agent_name="Explorer",
            span_name="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=1_800,
        )
        self.store_call_site(
            agent_name="PR Review",
            span_name="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=0,
        )

        by_agent = {
            entry.agent_label: entry for entry in fetch_call_site_stats(self.project, self.window)
        }

        assert set(by_agent) == {"Explorer", "PR Review"}
        assert by_agent["Explorer"].hit_rate == 0.9
        assert by_agent["PR Review"].hit_rate == 0

    def test_keeps_spans_without_an_agent_name_as_their_own_call_site(self) -> None:
        # One (span.name, model) pair holding both named and unnamed spans is
        # what makes the fallback a per-span decision: merging the unnamed ones
        # into their named sibling would credit an agent with calls it never made.
        self.store_call_site(
            agent_name="Explorer",
            span_name="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=1_800,
        )
        self.store_call_site(
            span_name="generate_content gemini",
            operation_name="generate_content",
            model=GEMINI,
            cache_read_tokens=0,
        )

        stats = fetch_call_site_stats(self.project, self.window)

        assert {(entry.agent_label, entry.agent_label_source) for entry in stats} == {
            ("Explorer", AgentLabelSource.AGENT_NAME),
            ("generate_content", AgentLabelSource.OPERATION_NAME),
        }
        assert sum(entry.call_count for entry in stats) == 2 * CALLS_PER_CALL_SITE

    def test_aggregates_token_sums_per_call_site(self) -> None:
        self.store_call_site(
            agent_name="Chat",
            span_name="generate_content claude",
            model=CLAUDE,
            cache_read_tokens=0,
            cache_creation_tokens=0,
        )
        self.store_call_site(
            agent_name="Summarizer",
            span_name="generate_content gemini",
            model=GEMINI,
            input_tokens=4_000,
            cache_read_tokens=3_000,
        )

        stats = fetch_call_site_stats(self.project, self.window)

        uncached = self.stats_for(stats, CLAUDE)
        assert uncached.agent_label == "Chat"
        assert uncached.agent_label_source is AgentLabelSource.AGENT_NAME
        assert uncached.span_name == "generate_content claude"
        assert uncached.call_count == CALLS_PER_CALL_SITE
        assert uncached.sum_input_tokens == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert uncached.sum_cache_read_tokens == 0
        assert uncached.sum_cache_creation_tokens == 0
        assert uncached.avg_input_tokens == INPUT_TOKENS
        assert uncached.hit_rate == 0

        cached = self.stats_for(stats, GEMINI)
        assert cached.agent_label == "Summarizer"
        assert cached.sum_input_tokens == 4_000 * CALLS_PER_CALL_SITE
        assert cached.sum_cache_read_tokens == 3_000 * CALLS_PER_CALL_SITE
        assert cached.hit_rate == 0.75

    def test_excludes_non_generate_content_spans(self) -> None:
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)
        # invoke_agent spans re-aggregate their children's token usage, and other
        # ops have no prompt-cache concept at all.
        self.store_spans(
            [
                self.gen_ai_span(
                    op="gen_ai.invoke_agent",
                    operation_type="agent",
                    operation_name="invoke_agent",
                    model="excluded-invoke-agent",
                ),
                self.gen_ai_span(
                    op="gen_ai.embeddings",
                    operation_name="embeddings",
                    model="excluded-embeddings",
                ),
                self.gen_ai_span(
                    op="db.query",
                    operation_type=None,
                    operation_name=None,
                    model="excluded-db-query",
                ),
            ]
        )

        models = {entry.model for entry in fetch_call_site_stats(self.project, self.window)}

        assert CLAUDE in models
        assert not {model for model in models if model.startswith("excluded-")}

    def test_includes_every_op_an_sdk_emits_for_an_llm_call(self) -> None:
        # No SDK agrees on the op: the Python integrations emit gen_ai.chat,
        # gen_ai.responses and gen_ai.text_completion, and JS google-genai emits
        # generate_content. Matching an op would cover one of them, which is why
        # the filter keys on the ingestion-normalized operation type instead.
        for index, (op, operation_name) in enumerate(
            (
                ("gen_ai.chat", "chat"),
                ("gen_ai.responses", "chat"),
                ("gen_ai.text_completion", "text_completion"),
                ("gen_ai.generate_content", "generate_content"),
            )
        ):
            self.store_call_site(
                op=op,
                operation_name=operation_name,
                model=f"model-{index}",
                cache_read_tokens=0,
                cache_creation_tokens=0,
            )

        models = {entry.model for entry in fetch_call_site_stats(self.project, self.window)}

        assert {"model-0", "model-1", "model-2", "model-3"} <= models

    def test_counts_spans_written_under_the_deprecated_attribute_names(self) -> None:
        # Only langchain writes the canonical names; the shared record_token_usage
        # path and most other integrations emit the deprecated aliases. Querying
        # the canonical names still has to see them, via the resolver's backfill.
        self.store_call_site(
            model=CLAUDE,
            cache_read_tokens=1_200,
            cache_creation_tokens=300,
            deprecated_attribute_names=True,
        )

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        assert stats.sum_cache_read_tokens == 1_200 * CALLS_PER_CALL_SITE
        assert stats.sum_cache_creation_tokens == 300 * CALLS_PER_CALL_SITE
        assert stats.hit_rate == 0.6

    def test_does_not_double_count_across_attribute_families(self) -> None:
        # Both families resolve to the same column, so a call site carrying a mix
        # must total once rather than once per name.
        self.store_spans(
            [
                self.gen_ai_span(model=CLAUDE, cache_read_tokens=1_000),
                self.gen_ai_span(
                    model=CLAUDE, cache_read_tokens=500, deprecated_attribute_names=True
                ),
            ]
        )

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        assert stats.sum_cache_read_tokens == 1_500

    def test_probe_sees_spans_using_the_deprecated_attribute_names(self) -> None:
        # The instrumentation-gap probe reads the same names, so a false UNKNOWN
        # here would suppress every finding from these integrations.
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, deprecated_attribute_names=True)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        assert (
            count_spans_with_cache_attributes(self.project, stats, self.window)
            == CALLS_PER_CALL_SITE
        )

    def test_measures_how_many_calls_met_a_warm_cache(self) -> None:
        # Every call at one moment: the first meets a cold cache, the rest a
        # cache the calls before them just filled.
        self.store_call_site(agent_name="Explorer", model=CLAUDE, cache_read_tokens=0)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert warmth is not None
        assert warmth.total_call_count == CALLS_PER_CALL_SITE
        assert warmth.warm_call_count == CALLS_PER_CALL_SITE - 1

    def test_counts_calls_spaced_wider_than_the_cache_ttl_as_cold(self) -> None:
        # An hour between calls outlives any prompt cache, so no volume of them
        # adds up to a call site that can cache.
        self.store_spans(
            [
                self.gen_ai_span(
                    agent_name="Explorer",
                    model=CLAUDE,
                    cache_read_tokens=0,
                    start_ts=before_now(hours=hour + 1),
                )
                for hour in range(CALLS_PER_CALL_SITE)
            ]
        )

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert warmth is not None
        assert warmth.total_call_count == CALLS_PER_CALL_SITE
        assert warmth.warm_call_count == 0

    def test_measures_warmth_for_a_call_site_named_after_its_operation(self) -> None:
        # Spans carrying no agent name are a call site of their own, and the
        # query that measures them has to select them by that same absence.
        self.store_call_site(model=CLAUDE, operation_name="generate_content", cache_read_tokens=0)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert stats.agent_label_source is AgentLabelSource.OPERATION_NAME
        assert warmth is not None
        assert warmth.warm_call_count == CALLS_PER_CALL_SITE - 1

    def test_reads_warmth_across_an_agents_operation_names(self) -> None:
        # An agent reporting two operation names is still one call site, so both
        # calls belong to the same bucket -- a cold call followed by a warm one,
        # not two cold starts.
        self.store_spans(
            [
                self.gen_ai_span(
                    agent_name="Explorer",
                    operation_name=operation_name,
                    model=CLAUDE,
                    cache_read_tokens=0,
                )
                for operation_name in ("chat", "generate_content")
            ]
        )

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert warmth is not None
        assert warmth.total_call_count == 2
        assert warmth.warm_call_count == 1

    def test_excludes_other_projects(self) -> None:
        other_project = self.create_project()
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)
        self.store_call_site(
            model="excluded-other-project",
            cache_read_tokens=1_000,
            project=other_project,
            count=2,
        )

        models = {entry.model for entry in fetch_call_site_stats(self.project, self.window)}

        assert CLAUDE in models
        assert "excluded-other-project" not in models


class CachePresenceProbeTest(LLMCacheDetectionIntegrationTest):
    """The probe distinguishes 'never caches' from 'never reports cache attributes'."""

    def test_counts_spans_reporting_explicit_zero_cache_tokens(self) -> None:
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        # A provider that reports a real zero must not look like missing
        # instrumentation, or every genuinely uncached call site is discarded.
        assert (
            count_spans_with_cache_attributes(self.project, stats, self.window)
            == CALLS_PER_CALL_SITE
        )

    def test_counts_zero_when_cache_attributes_are_absent(self) -> None:
        self.store_call_site(model=CLAUDE)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        assert count_spans_with_cache_attributes(self.project, stats, self.window) == 0

    def test_scopes_the_probe_to_its_own_call_site(self) -> None:
        # Both call sites share a model and an agent, so the span name is the
        # only term that separates them: unescaped, the literal asterisk degrades
        # it to a wildcard that also swallows the sibling call site.
        self.store_call_site(span_name="generate_content */chat", model=CLAUDE, cache_read_tokens=0)
        self.store_call_site(span_name="generate_content x/chat", model=CLAUDE, cache_read_tokens=0)

        stats = next(
            entry
            for entry in fetch_call_site_stats(self.project, self.window)
            if entry.span_name == "generate_content */chat"
        )

        assert (
            count_spans_with_cache_attributes(self.project, stats, self.window)
            == CALLS_PER_CALL_SITE
        )

    def test_scopes_the_probe_to_spans_that_carry_no_agent_name(self) -> None:
        # A fallback label covers exactly the spans without an agent name. The
        # named sibling here does report cache attributes, so a filter missing
        # the absence term would count them and call the gap instrumented.
        self.store_call_site(
            agent_name="Explorer",
            span_name="generate_content claude",
            model=CLAUDE,
            cache_read_tokens=0,
        )
        self.store_call_site(
            span_name="generate_content claude",
            operation_name="generate_content",
            model=CLAUDE,
        )

        unnamed = next(
            entry
            for entry in fetch_call_site_stats(self.project, self.window)
            if entry.agent_label_source is AgentLabelSource.OPERATION_NAME
        )

        assert count_spans_with_cache_attributes(self.project, unnamed, self.window) == 0


class FetchSampleCallsTest(LLMCacheDetectionIntegrationTest):
    def test_returns_calls_from_the_call_site(self) -> None:
        spans = [
            self.gen_ai_span(model=CLAUDE, cache_read_tokens=0) for _ in range(CALLS_PER_CALL_SITE)
        ]
        self.store_spans(spans)
        spans_by_span_id = {span["span_id"]: span for span in spans}

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)
        samples = fetch_sample_calls(self.project, stats, self.window)

        assert samples
        for sample in samples:
            # The deep link is only correct if the span id identifies the gen-AI
            # call itself, not some other span sharing its trace.
            source_span = spans_by_span_id[sample.span_id]
            assert sample.trace_id == source_span["trace_id"]
            assert sample.input_tokens == INPUT_TOKENS
            assert sample.cache_read_tokens == 0
            assert sample.timestamp

    def test_returns_one_call_per_trace(self) -> None:
        # A call site that fires repeatedly inside one trace should still yield
        # distinct examples rather than the same trace three times.
        trace_id = uuid4().hex
        self.store_spans(
            [
                self.gen_ai_span(model=CLAUDE, cache_read_tokens=0) | {"trace_id": trace_id}
                for _ in range(CALLS_PER_CALL_SITE)
            ]
        )

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)
        samples = fetch_sample_calls(self.project, stats, self.window)

        assert [sample.trace_id for sample in samples] == [trace_id]


class FetchSamplePromptsTest(LLMCacheDetectionIntegrationTest):
    def test_returns_nothing_when_the_spans_carry_no_prompt_text(self) -> None:
        # Sending prompts is opt-in, so this is the ordinary shape of the data.
        self.store_call_site(model=CLAUDE, cache_read_tokens=0)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        assert fetch_sample_prompts(self.project, stats, self.window) == []

    def test_returns_the_prompt_text_of_the_call_site(self) -> None:
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, prompt=PROMPT)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        prompts = fetch_sample_prompts(self.project, stats, self.window)

        assert prompts == [PROMPT] * PROMPT_SAMPLES_LIMIT

    def test_reads_the_deprecated_prompt_attribute(self) -> None:
        # SDKs are part-way through the move off `gen_ai.request.messages`, so a
        # call site writing the old name still has to be readable.
        self.store_call_site(
            model=CLAUDE, cache_read_tokens=0, prompt=PROMPT, deprecated_attribute_names=True
        )

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        prompts = fetch_sample_prompts(self.project, stats, self.window)

        assert prompts == [PROMPT] * PROMPT_SAMPLES_LIMIT

    def test_returns_one_prompt_per_trace(self) -> None:
        # Repeat calls inside one trace are one invocation's worth of evidence,
        # and comparing a prompt against itself would report a false agreement.
        trace_id = uuid4().hex
        self.store_spans(
            [
                self.gen_ai_span(model=CLAUDE, cache_read_tokens=0, prompt=PROMPT)
                | {"trace_id": trace_id}
                for _ in range(CALLS_PER_CALL_SITE)
            ]
        )

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        assert fetch_sample_prompts(self.project, stats, self.window) == [PROMPT]

    def test_scopes_the_prompts_to_their_own_call_site(self) -> None:
        other_prompt = '[{"role": "system", "content": "Draft a release note."}]'
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, prompt=PROMPT)
        self.store_call_site(model=GEMINI, span_name="generate_content gemini", prompt=other_prompt)

        stats = self.stats_for(fetch_call_site_stats(self.project, self.window), CLAUDE)

        prompts = fetch_sample_prompts(self.project, stats, self.window)

        assert prompts == [PROMPT] * PROMPT_SAMPLES_LIMIT


# Each seeded call site is a handful of spans; which volumes the eligibility
# floors let through is settled in the detection tests.
@patch("sentry.llm_cache_detection.detection.MIN_CALLS_FOR_CONFIDENCE", 1)
@patch("sentry.llm_cache_detection.detection.MIN_SAMPLED_CALLS", 1)
@patch("sentry.llm_cache_detection.issue_platform_adapter.produce_occurrence_to_kafka")
class DetectLLMCacheIssuesTest(LLMCacheDetectionIntegrationTest):
    def test_flags_a_call_site_that_never_caches(self, mock_produce: MagicMock) -> None:
        self.store_call_site(
            agent_name="Summarizer",
            span_name="generate_content gemini",
            model=GEMINI,
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 1
        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert occurrence.type == LLMCacheUsageGroupType
        assert occurrence.issue_title == "Uncached LLM Prompts"
        assert occurrence.culprit == "Summarizer"
        assert occurrence.subtitle == f"Summarizer | generate_content gemini | {GEMINI}"

        evidence = occurrence.evidence_data
        assert evidence["model"] == GEMINI
        assert evidence["call_count"] == CALLS_PER_CALL_SITE
        assert evidence["hit_rate"] == 0
        assert evidence["sum_input_tokens"] == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert evidence["uncached_tokens"] == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert evidence["sample_traces"]

        event_data = mock_produce.call_args.kwargs["event_data"]
        assert event_data["project_id"] == self.project.id
        assert event_data["tags"]["gen_ai.agent.name"] == "Summarizer"
        assert (
            event_data["contexts"]["trace"]["trace_id"] == evidence["sample_traces"][0]["trace_id"]
        )

    def test_flags_a_call_site_that_thrashes_its_cache(self, mock_produce: MagicMock) -> None:
        # Writes dominate reads: the call site pays the cache-write premium on
        # nearly every call without collecting the reads back.
        self.store_call_site(
            agent_name="Malicious Issue Detection",
            span_name="generate_content claude",
            model=CLAUDE,
            cache_read_tokens=100,
            cache_creation_tokens=1_500,
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 1
        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert occurrence.issue_title == "LLM Cache Thrash"
        assert occurrence.evidence_data["write_read_ratio"] == 15

    def test_does_not_flag_a_healthy_call_site(self, mock_produce: MagicMock) -> None:
        self.store_call_site(model=CLAUDE, cache_read_tokens=1_800, cache_creation_tokens=100)

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert not mock_produce.called

    def test_does_not_flag_when_cache_attributes_are_never_reported(
        self, mock_produce: MagicMock
    ) -> None:
        # Zero sums on a provider that reports zeros means the instrumentation
        # dropped the attributes, not that the call site never caches.
        self.store_call_site(model=CLAUDE)

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert not mock_produce.called

    def test_diagnoses_where_the_sampled_prompts_stop_agreeing(
        self, mock_produce: MagicMock
    ) -> None:
        # Two invocations of one call site whose template puts a timestamp in
        # front of everything stable, so nothing the provider could cache is
        # ever in the same place twice.
        stable_body = "Rank the rows and explain the ranking.\n" * 120
        self.store_spans(
            [
                self.gen_ai_span(
                    model=GEMINI,
                    span_name="generate_content gemini",
                    prompt=f'[{{"role": "system", "content": "As of {moment}. {stable_body}"}}]',
                )
                for moment in ("2026-08-19T10:15:00Z", "2026-08-19T11:47:31Z")
                for _ in range(2)
            ]
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 1
        evidence = mock_produce.call_args.kwargs["occurrence"].evidence_data
        assert evidence["prompt_sample_count"] == PROMPT_SAMPLES_LIMIT
        assert evidence["prompt_divergence_kind"] == "iso_timestamp"
        # A floor, not the exact size: the block is aligned in whole pieces, so
        # the one straddling the divergence is dropped rather than half-counted.
        assert evidence["prompt_stable_block_chars"] >= len(stable_body) * 0.9
        assert evidence["prompt_template_misordered"] is True
        assert evidence["prompt_template_misordered"] is True

    def test_attaches_a_healthy_same_model_call_site_as_contrast(
        self, mock_produce: MagicMock
    ) -> None:
        self.store_call_site(
            agent_name="PR Review", span_name="generate_content gemini", model=GEMINI
        )
        self.store_call_site(
            agent_name="Explorer",
            span_name="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=1_800,
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 1
        evidence = mock_produce.call_args.kwargs["occurrence"].evidence_data
        assert evidence["agent_label"] == "PR Review"
        assert evidence["contrast_agent_label"] == "Explorer"
        assert evidence["contrast_hit_rate"] == 0.9

    def test_files_one_issue_per_agent_behind_a_shared_span_name(
        self, mock_produce: MagicMock
    ) -> None:
        # Two agents, one SDK wrapper, both caching badly but not equally. Keyed
        # on the wrapper they would be one issue naming code neither owns.
        self.store_call_site(
            agent_name="Explorer", span_name="generate_content gemini", model=GEMINI
        )
        self.store_call_site(
            agent_name="PR Review",
            span_name="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=50,
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 2
        occurrences = [call.kwargs["occurrence"] for call in mock_produce.call_args_list]
        assert {occurrence.subtitle for occurrence in occurrences} == {
            f"Explorer | generate_content gemini | {GEMINI}",
            f"PR Review | generate_content gemini | {GEMINI}",
        }
        assert len({tuple(occurrence.fingerprint) for occurrence in occurrences}) == 2

    def test_files_one_issue_per_label_when_only_some_spans_name_an_agent(
        self, mock_produce: MagicMock
    ) -> None:
        self.store_call_site(
            agent_name="Explorer", span_name="generate_content gemini", model=GEMINI
        )
        self.store_call_site(
            span_name="generate_content gemini", operation_name="generate_content", model=GEMINI
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 2
        evidence = [call.kwargs["occurrence"].evidence_data for call in mock_produce.call_args_list]
        assert {(entry["agent_label"], entry["agent_label_source"]) for entry in evidence} == {
            ("Explorer", "gen_ai.agent.name"),
            ("generate_content", "gen_ai.operation.name"),
        }

    def test_fan_out_reaches_a_project_that_sent_gen_ai_spans(
        self, mock_produce: MagicMock
    ) -> None:
        self.store_call_site(model=GEMINI)
        self.project.flags.has_insights_agent_monitoring = True
        self.project.save()

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}), TaskRunner():
            run_llm_cache_issue_detection()

        assert mock_produce.call_count == 1

    def test_fan_out_skips_a_project_without_gen_ai_spans(self, mock_produce: MagicMock) -> None:
        self.store_call_site(model=GEMINI)
        assert not self.project.flags.has_insights_agent_monitoring

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}), TaskRunner():
            run_llm_cache_issue_detection()

        assert not mock_produce.called
