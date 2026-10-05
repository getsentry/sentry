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
from sentry.tasks.llm_cache_issue_detection import detect_llm_cache_issues_for_project
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now

DETECTION_FEATURE = "organizations:llm-cache-detection"

# Above the cacheable minimum of every model used here, so eligibility turns
# purely on the call count, which each test lowers to keep the seeded span
# volume small.
INPUT_TOKENS = 3_000
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
        """Build a gen-AI call span; omitted token kwargs are left off it entirely.

        ``gen_ai.operation.type`` is normally derived from the op at ingestion,
        which spans written straight to EAP skip. The name doubles as the
        description, as on real gen-AI spans. ``agent_name`` defaults to absent,
        as plenty of SDK paths never emit one.
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
                "sentry_tags": {"op": op, "transaction": "/chat", "name": span_name},
                "data": data,
            },
            start_ts=start_ts or self.ten_mins_ago,
        )

    def store_call_site(self, *, count: int = CALLS_PER_CALL_SITE, **kwargs: Any) -> None:
        self.store_spans([self.gen_ai_span(**kwargs) for _ in range(count)])

    def fetch_call_site(self, model: str = CLAUDE) -> CallSiteStats:
        """Aggregate the project's spans and return its one call site on ``model``."""
        call_sites = fetch_call_site_stats(self.project, self.window).call_sites
        matching = [entry for entry in call_sites if entry.model == model]
        assert len(matching) == 1, f"expected exactly one {model} call site, got {matching}"
        return matching[0]


class FetchCallSiteStatsTest(LLMCacheDetectionIntegrationTest):
    def test_separates_two_agents_sharing_a_span_name_and_model(self) -> None:
        # Both call through the same SDK wrapper span name.
        self.store_call_site(
            agent_name="Researcher",
            span_name="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=2_700,
        )
        self.store_call_site(
            agent_name="Reviewer",
            span_name="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=0,
        )

        by_agent = {
            entry.agent_label: entry
            for entry in fetch_call_site_stats(self.project, self.window).call_sites
        }

        assert set(by_agent) == {"Researcher", "Reviewer"}
        assert by_agent["Researcher"].hit_rate == 0.9
        assert by_agent["Reviewer"].hit_rate == 0

    def test_keeps_spans_without_an_agent_name_as_their_own_call_site(self) -> None:
        # Merging unnamed spans into a named sibling would credit it with their calls.
        self.store_call_site(
            agent_name="Researcher",
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

        stats = fetch_call_site_stats(self.project, self.window).call_sites

        assert {(entry.agent_label, entry.agent_label_source) for entry in stats} == {
            ("Researcher", AgentLabelSource.AGENT_NAME),
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

        uncached = self.fetch_call_site(CLAUDE)
        assert uncached.agent_label == "Chat"
        assert uncached.agent_label_source is AgentLabelSource.AGENT_NAME
        assert uncached.span_name == "generate_content claude"
        assert uncached.call_count == CALLS_PER_CALL_SITE
        # Unsampled, so the stored-span count the evidence floor reads agrees.
        assert uncached.sampled_call_count == CALLS_PER_CALL_SITE
        assert uncached.sum_input_tokens == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert uncached.sum_cache_read_tokens == 0
        assert uncached.sum_cache_creation_tokens == 0
        assert uncached.avg_input_tokens == INPUT_TOKENS
        assert uncached.hit_rate == 0

        cached = self.fetch_call_site(GEMINI)
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

        models = {
            entry.model for entry in fetch_call_site_stats(self.project, self.window).call_sites
        }

        assert CLAUDE in models
        assert not {model for model in models if model.startswith("excluded-")}

    def test_includes_every_op_an_sdk_emits_for_an_llm_call(self) -> None:
        # No two SDKs agree on the op, hence the normalized operation type.
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

        models = {
            entry.model for entry in fetch_call_site_stats(self.project, self.window).call_sites
        }

        assert {"model-0", "model-1", "model-2", "model-3"} <= models

    def test_counts_spans_written_under_the_deprecated_attribute_names(self) -> None:
        # Most integrations emit the deprecated aliases, backfilled at ingestion.
        self.store_call_site(
            model=CLAUDE,
            cache_read_tokens=1_800,
            cache_creation_tokens=450,
            deprecated_attribute_names=True,
        )

        stats = self.fetch_call_site()

        assert stats.sum_cache_read_tokens == 1_800 * CALLS_PER_CALL_SITE
        assert stats.sum_cache_creation_tokens == 450 * CALLS_PER_CALL_SITE
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

        stats = self.fetch_call_site()

        assert stats.sum_cache_read_tokens == 1_500

    def test_excludes_other_projects(self) -> None:
        other_project = self.create_project()
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)
        self.store_call_site(
            model="excluded-other-project",
            cache_read_tokens=1_000,
            project=other_project,
            count=2,
        )

        models = {
            entry.model for entry in fetch_call_site_stats(self.project, self.window).call_sites
        }

        assert CLAUDE in models
        assert "excluded-other-project" not in models


class FetchCallSiteWarmthTest(LLMCacheDetectionIntegrationTest):
    def test_measures_how_many_calls_met_a_warm_cache(self) -> None:
        # Every call at one moment: the first meets a cold cache, the rest a
        # cache the calls before them just filled.
        self.store_call_site(agent_name="Researcher", model=CLAUDE, cache_read_tokens=0)

        stats = self.fetch_call_site()
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert warmth is not None
        assert warmth.total_call_count == CALLS_PER_CALL_SITE
        assert warmth.warm_call_count == CALLS_PER_CALL_SITE - 1

    def test_counts_calls_spaced_wider_than_the_long_ttl_as_cold(self) -> None:
        # Two hours between calls outlive even the long TTL, so no volume of them
        # adds up to a call site that can cache.
        self.store_spans(
            [
                self.gen_ai_span(
                    agent_name="Researcher",
                    model=CLAUDE,
                    cache_read_tokens=0,
                    start_ts=before_now(hours=2 * index + 1),
                )
                for index in range(CALLS_PER_CALL_SITE)
            ]
        )

        stats = self.fetch_call_site()
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert warmth is not None
        assert warmth.total_call_count == CALLS_PER_CALL_SITE
        assert warmth.warm_call_count == 0
        assert warmth.long_ttl_warm_call_count == 0

    def test_counts_calls_warm_only_at_the_long_ttl(self) -> None:
        # Twenty minutes apart: cold at the default TTL, but six calls over 100
        # minutes share an hour with at least one other.
        self.store_spans(
            [
                self.gen_ai_span(
                    agent_name="Researcher",
                    model=CLAUDE,
                    cache_read_tokens=0,
                    start_ts=before_now(minutes=20 * index + 1),
                )
                for index in range(CALLS_PER_CALL_SITE)
            ]
        )

        stats = self.fetch_call_site()
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert warmth is not None
        assert warmth.total_call_count == CALLS_PER_CALL_SITE
        assert warmth.warm_call_count == 0
        assert warmth.long_ttl_warm_call_count > 0

    def test_reads_warmth_across_an_agents_operation_names(self) -> None:
        # One call site across two operation names: one cold start, not two.
        self.store_spans(
            [
                self.gen_ai_span(
                    agent_name="Researcher",
                    operation_name=operation_name,
                    model=CLAUDE,
                    cache_read_tokens=0,
                )
                for operation_name in ("chat", "generate_content")
            ]
        )

        stats = self.fetch_call_site()
        warmth = fetch_call_site_warmth(self.project, stats, self.window)

        assert warmth is not None
        assert warmth.total_call_count == 2
        assert warmth.warm_call_count == 1


class CachePresenceProbeTest(LLMCacheDetectionIntegrationTest):
    """The probe distinguishes 'never caches' from 'never reports cache attributes'."""

    def test_counts_spans_using_the_deprecated_attribute_names(self) -> None:
        # A false UNKNOWN here would suppress every finding from the integrations
        # that emit the deprecated names.
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, deprecated_attribute_names=True)

        stats = self.fetch_call_site()

        assert (
            count_spans_with_cache_attributes(self.project, stats, self.window)
            == CALLS_PER_CALL_SITE
        )

    def test_counts_spans_reporting_explicit_zero_cache_tokens(self) -> None:
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)

        stats = self.fetch_call_site()

        # A provider that reports a real zero must not look like missing
        # instrumentation, or every genuinely uncached call site is discarded.
        assert (
            count_spans_with_cache_attributes(self.project, stats, self.window)
            == CALLS_PER_CALL_SITE
        )

    def test_counts_zero_when_cache_attributes_are_absent(self) -> None:
        self.store_call_site(model=CLAUDE)

        stats = self.fetch_call_site()

        assert count_spans_with_cache_attributes(self.project, stats, self.window) == 0

    def test_scopes_the_probe_to_its_own_call_site(self) -> None:
        # Unescaped, the literal asterisk would match the sibling call site too.
        self.store_call_site(span_name="generate_content */chat", model=CLAUDE, cache_read_tokens=0)
        self.store_call_site(span_name="generate_content x/chat", model=CLAUDE, cache_read_tokens=0)

        stats = next(
            entry
            for entry in fetch_call_site_stats(self.project, self.window).call_sites
            if entry.span_name == "generate_content */chat"
        )

        assert (
            count_spans_with_cache_attributes(self.project, stats, self.window)
            == CALLS_PER_CALL_SITE
        )

    def test_scopes_the_probe_to_spans_that_carry_no_agent_name(self) -> None:
        # The named sibling reports cache attributes; the probe must not count them.
        self.store_call_site(
            agent_name="Researcher",
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
            for entry in fetch_call_site_stats(self.project, self.window).call_sites
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

        stats = self.fetch_call_site()
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

        stats = self.fetch_call_site()
        samples = fetch_sample_calls(self.project, stats, self.window)

        assert samples is not None
        assert [sample.trace_id for sample in samples] == [trace_id]


class FetchSamplePromptsTest(LLMCacheDetectionIntegrationTest):
    def test_returns_nothing_when_the_spans_carry_no_prompt_text(self) -> None:
        # Sending prompts is opt-in, so this is the ordinary shape of the data.
        self.store_call_site(model=CLAUDE, cache_read_tokens=0)

        stats = self.fetch_call_site()

        assert fetch_sample_prompts(self.project, stats, self.window) == []

    def test_reads_the_deprecated_prompt_attribute(self) -> None:
        # SDKs are part-way through the move off `gen_ai.request.messages`, so a
        # call site writing the old name still has to be readable.
        self.store_call_site(
            model=CLAUDE, cache_read_tokens=0, prompt=PROMPT, deprecated_attribute_names=True
        )

        stats = self.fetch_call_site()

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

        stats = self.fetch_call_site()

        assert fetch_sample_prompts(self.project, stats, self.window) == [PROMPT]

    def test_scopes_the_prompts_to_their_own_call_site(self) -> None:
        other_prompt = '[{"role": "system", "content": "Draft a release note."}]'
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, prompt=PROMPT)
        self.store_call_site(model=GEMINI, span_name="generate_content gemini", prompt=other_prompt)

        stats = self.fetch_call_site()

        prompts = fetch_sample_prompts(self.project, stats, self.window)

        assert prompts == [PROMPT] * PROMPT_SAMPLES_LIMIT


def findings(mock_logger: MagicMock) -> list[dict[str, Any]]:
    return [
        call.kwargs["extra"]
        for call in mock_logger.info.call_args_list
        if call.args[0] == "llm_cache_issue_detection.candidate_resolved"
        and call.kwargs["extra"]["disposition"]
    ]


# Each seeded call site is a handful of spans; which volumes the eligibility
# floors let through is settled in the detection tests.
@patch("sentry.llm_cache_detection.detection.MIN_CALLS_FOR_CONFIDENCE", 1)
@patch("sentry.llm_cache_detection.detection.MIN_SAMPLED_CALLS", 1)
@patch("sentry.llm_cache_detection.reporting.logger")
class DetectLLMCacheIssuesTest(LLMCacheDetectionIntegrationTest):
    def test_flags_a_call_site_that_never_caches(self, mock_logger: MagicMock) -> None:
        self.store_call_site(
            agent_name="Summarizer",
            span_name="generate_content gemini",
            model=GEMINI,
        )

        with self.feature({DETECTION_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        [finding] = findings(mock_logger)
        assert finding["outcome"] == "not_caching"
        assert finding["reason"] == "positive_only_reporter"
        assert finding["disposition"] == "would_create"
        assert finding["agent_label"] == "Summarizer"
        assert finding["model"] == GEMINI
        assert finding["call_count"] == CALLS_PER_CALL_SITE
        assert finding["hit_rate"] == 0
        assert finding["sum_input_tokens"] == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert finding["uncached_tokens"] == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert finding["warm_call_count"] > 0
        assert finding["sample_calls"]

    def test_flags_a_call_site_that_thrashes_its_cache(self, mock_logger: MagicMock) -> None:
        # Writes dominate reads: the call site pays the cache-write premium on
        # nearly every call without collecting the reads back.
        self.store_call_site(
            agent_name="Classifier",
            span_name="generate_content claude",
            model=CLAUDE,
            cache_read_tokens=100,
            cache_creation_tokens=1_500,
        )

        with self.feature({DETECTION_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        [finding] = findings(mock_logger)
        assert finding["outcome"] == "thrash"
        assert finding["write_read_ratio"] == 15

    def test_diagnoses_where_the_sampled_prompts_stop_agreeing(
        self, mock_logger: MagicMock
    ) -> None:
        # A timestamp in front of everything stable leaves nothing cacheable.
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

        with self.feature({DETECTION_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        [finding] = findings(mock_logger)
        assert finding["prompt_sample_count"] == PROMPT_SAMPLES_LIMIT
        assert finding["prompt_divergence_kind"] == "iso_timestamp"
        # A floor, not the exact size: the block is aligned in whole pieces, so
        # the one straddling the divergence is dropped rather than half-counted.
        assert finding["prompt_stable_block_chars"] >= len(stable_body) * 0.9
        assert finding["prompt_template_misordered"] is True
