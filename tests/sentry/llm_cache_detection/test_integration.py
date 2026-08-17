"""End-to-end coverage against a real Snuba EAP instance.

The unit tests mock the query layer out, so nothing else exercises the search
grammar filter, the EAP attribute names, or the aggregation itself -- the parts
that fail silently as "no findings" rather than as an error.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sentry.issues.grouptype import LLMCacheUsageGroupType
from sentry.llm_cache_detection.detection import CallSiteStats
from sentry.llm_cache_detection.query import (
    count_spans_with_cache_attributes,
    fetch_call_site_stats,
    fetch_sample_trace_ids,
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

CLAUDE = "claude-sonnet-4"
# Gemini reports cache attributes only when positive, which is what lets a call
# site be flagged without the instrumentation-gap probe.
GEMINI = "gemini-2.5-pro"


class LLMCacheDetectionIntegrationTest(TestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def gen_ai_span(
        self,
        *,
        transaction: str = "/chat",
        description: str = "generate_content claude",
        model: str = CLAUDE,
        input_tokens: int = INPUT_TOKENS,
        cache_read_tokens: int | None = None,
        cache_creation_tokens: int | None = None,
        op: str = "gen_ai.generate_content",
        project: Project | None = None,
    ) -> dict[str, Any]:
        """Build a gen-AI call span. Omitted token kwargs are left off the span entirely."""
        data: dict[str, Any] = {
            "gen_ai.request.model": model,
            "gen_ai.usage.input_tokens": input_tokens,
        }
        if cache_read_tokens is not None:
            data["gen_ai.usage.cache_read.input_tokens"] = cache_read_tokens
        if cache_creation_tokens is not None:
            data["gen_ai.usage.cache_creation.input_tokens"] = cache_creation_tokens

        return self.create_span(
            project=project or self.project,
            extra_data={
                "description": description,
                "sentry_tags": {"op": op, "transaction": transaction},
                "data": data,
            },
            start_ts=self.ten_mins_ago,
        )

    def store_call_site(self, *, count: int = CALLS_PER_CALL_SITE, **kwargs: Any) -> None:
        self.store_spans([self.gen_ai_span(**kwargs) for _ in range(count)])

    def stats_for(self, stats: list[CallSiteStats], model: str) -> CallSiteStats:
        matching = [entry for entry in stats if entry.model == model]
        assert len(matching) == 1, f"expected exactly one {model} call site, got {matching}"
        return matching[0]


class FetchCallSiteStatsTest(LLMCacheDetectionIntegrationTest):
    def test_aggregates_token_sums_per_call_site(self) -> None:
        self.store_call_site(
            transaction="/chat",
            description="generate_content claude",
            model=CLAUDE,
            cache_read_tokens=0,
            cache_creation_tokens=0,
        )
        self.store_call_site(
            transaction="/summarize",
            description="generate_content gemini",
            model=GEMINI,
            input_tokens=4_000,
            cache_read_tokens=3_000,
        )

        stats = fetch_call_site_stats(self.project)

        assert len(stats) == 2

        uncached = self.stats_for(stats, CLAUDE)
        assert uncached.transaction == "/chat"
        assert uncached.span_description == "generate_content claude"
        assert uncached.call_count == CALLS_PER_CALL_SITE
        assert uncached.sum_input_tokens == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert uncached.sum_cache_read_tokens == 0
        assert uncached.sum_cache_creation_tokens == 0
        assert uncached.avg_input_tokens == INPUT_TOKENS
        assert uncached.hit_rate == 0

        cached = self.stats_for(stats, GEMINI)
        assert cached.transaction == "/summarize"
        assert cached.sum_input_tokens == 4_000 * CALLS_PER_CALL_SITE
        assert cached.sum_cache_read_tokens == 3_000 * CALLS_PER_CALL_SITE
        assert cached.hit_rate == 0.75

    def test_excludes_non_generate_content_spans(self) -> None:
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)
        # invoke_agent spans re-aggregate their children's token usage, and other
        # ops have no prompt-cache concept at all.
        self.store_spans(
            [
                self.gen_ai_span(op="gen_ai.invoke_agent", model="agent-model"),
                self.gen_ai_span(op="gen_ai.embeddings", model="embedding-model"),
                self.gen_ai_span(op="db.query", model="not-a-model"),
            ]
        )

        stats = fetch_call_site_stats(self.project)

        assert [entry.model for entry in stats] == [CLAUDE]

    def test_excludes_other_projects(self) -> None:
        other_project = self.create_project()
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)
        self.store_call_site(model=GEMINI, cache_read_tokens=1_000, project=other_project, count=2)

        assert [entry.model for entry in fetch_call_site_stats(self.project)] == [CLAUDE]


class CachePresenceProbeTest(LLMCacheDetectionIntegrationTest):
    """The probe distinguishes 'never caches' from 'never reports cache attributes'."""

    def test_counts_spans_reporting_explicit_zero_cache_tokens(self) -> None:
        self.store_call_site(model=CLAUDE, cache_read_tokens=0, cache_creation_tokens=0)

        stats = self.stats_for(fetch_call_site_stats(self.project), CLAUDE)

        # A provider that reports a real zero must not look like missing
        # instrumentation, or every genuinely uncached call site is discarded.
        assert count_spans_with_cache_attributes(self.project, stats) == CALLS_PER_CALL_SITE

    def test_counts_zero_when_cache_attributes_are_absent(self) -> None:
        self.store_call_site(model=CLAUDE)

        stats = self.stats_for(fetch_call_site_stats(self.project), CLAUDE)

        assert count_spans_with_cache_attributes(self.project, stats) == 0

    def test_scopes_the_probe_to_its_own_call_site(self) -> None:
        # Both call sites share a model and transaction, so the description is
        # the only term that separates them: unescaped, the literal asterisk
        # degrades it to a wildcard that also swallows the sibling call site.
        self.store_call_site(
            description="generate_content */chat", model=CLAUDE, cache_read_tokens=0
        )
        self.store_call_site(
            description="generate_content x/chat", model=CLAUDE, cache_read_tokens=0
        )

        all_stats = fetch_call_site_stats(self.project)
        assert len(all_stats) == 2
        stats = next(
            entry for entry in all_stats if entry.span_description == "generate_content */chat"
        )

        assert count_spans_with_cache_attributes(self.project, stats) == CALLS_PER_CALL_SITE


class FetchSampleTraceIdsTest(LLMCacheDetectionIntegrationTest):
    def test_returns_trace_ids_from_the_call_site(self) -> None:
        spans = [
            self.gen_ai_span(model=CLAUDE, cache_read_tokens=0) for _ in range(CALLS_PER_CALL_SITE)
        ]
        self.store_spans(spans)
        expected_trace_ids = {span["trace_id"] for span in spans}

        stats = self.stats_for(fetch_call_site_stats(self.project), CLAUDE)
        trace_ids = fetch_sample_trace_ids(self.project, stats)

        assert trace_ids
        assert set(trace_ids) <= expected_trace_ids


@patch("sentry.llm_cache_detection.detection.MIN_CALLS_PER_WINDOW", CALLS_PER_CALL_SITE)
@patch("sentry.llm_cache_detection.issue_platform_adapter.produce_occurrence_to_kafka")
class DetectLLMCacheIssuesTest(LLMCacheDetectionIntegrationTest):
    def test_flags_a_call_site_that_never_caches(self, mock_produce: MagicMock) -> None:
        self.store_call_site(
            transaction="/chat",
            description="generate_content gemini",
            model=GEMINI,
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 1
        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert occurrence.type == LLMCacheUsageGroupType
        assert occurrence.issue_title == "Uncached LLM Prompts"
        assert occurrence.culprit == "/chat"
        assert occurrence.subtitle == f"/chat | generate_content gemini | {GEMINI}"

        evidence = occurrence.evidence_data
        assert evidence["model"] == GEMINI
        assert evidence["call_count"] == CALLS_PER_CALL_SITE
        assert evidence["hit_rate"] == 0
        assert evidence["sum_input_tokens"] == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert evidence["uncached_tokens"] == INPUT_TOKENS * CALLS_PER_CALL_SITE
        assert evidence["sample_trace_ids"]

        event_data = mock_produce.call_args.kwargs["event_data"]
        assert event_data["project_id"] == self.project.id
        assert event_data["tags"]["transaction"] == "/chat"
        assert event_data["contexts"]["trace"]["trace_id"] == evidence["sample_trace_ids"][0]

    def test_flags_a_call_site_that_thrashes_its_cache(self, mock_produce: MagicMock) -> None:
        # Writes dominate reads: the call site pays the cache-write premium on
        # nearly every call without collecting the reads back.
        self.store_call_site(
            transaction="/agent",
            description="generate_content claude",
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

    def test_attaches_a_healthy_same_model_call_site_as_contrast(
        self, mock_produce: MagicMock
    ) -> None:
        self.store_call_site(
            transaction="/chat", description="generate_content gemini", model=GEMINI
        )
        self.store_call_site(
            transaction="/summarize",
            description="generate_content gemini",
            model=GEMINI,
            cache_read_tokens=1_800,
        )

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert mock_produce.call_count == 1
        evidence = mock_produce.call_args.kwargs["occurrence"].evidence_data
        assert evidence["transaction"] == "/chat"
        assert evidence["contrast_transaction"] == "/summarize"
        assert evidence["contrast_hit_rate"] == 0.9

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
