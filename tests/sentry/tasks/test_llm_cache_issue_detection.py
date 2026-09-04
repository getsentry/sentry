from contextlib import AbstractContextManager
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.db.models import F

from sentry import features
from sentry.issues.grouptype import LLMCacheUsageGroupType
from sentry.issues.ingest import hash_fingerprint
from sentry.llm_cache_detection.detection import (
    DETECTION_WINDOW_DAYS,
    AgentLabelSource,
    CallSiteStats,
    CallSiteWarmth,
)
from sentry.llm_cache_detection.issue_platform_adapter import create_fingerprint
from sentry.llm_cache_detection.query import SampleCall
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks import llm_cache_issue_detection
from sentry.tasks.llm_cache_issue_detection import (
    FINDINGS_PER_PROJECT_LIMIT,
    MAX_PRESENCE_PROBES_PER_PROJECT,
    MAX_WARMTH_PROBES_PER_PROJECT,
    detect_llm_cache_issues_for_project,
    run_llm_cache_issue_detection,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json

INGEST_FEATURE = LLMCacheUsageGroupType.build_ingest_feature_name()
DETECTION_FEATURE = "organizations:llm-cache-detection"

SAMPLE_CALLS = [
    SampleCall(
        trace_id="a" * 32,
        span_id="1" * 16,
        timestamp="2026-08-10T00:00:00+00:00",
        input_tokens=4_000,
        cache_read_tokens=0,
        cache_creation_tokens=0,
    ),
    SampleCall(
        trace_id="b" * 32,
        span_id="2" * 16,
        timestamp="2026-08-11T00:00:00+00:00",
        input_tokens=3_000,
        cache_read_tokens=0,
        cache_creation_tokens=0,
    ),
]


# Synthetic prompts, invented for the test: a variable head in front of a stable
# body, which is the shape the diagnosis exists to name. Real prompt text never
# goes in a fixture.
STABLE_PROMPT_BODY = "Summarize the rows below and cite each one.\n" * 100
DIVERGING_PROMPTS = [
    f'[{{"role": "system", "content": "As of 2026-08-19T10:15:00Z. {STABLE_PROMPT_BODY}"}}]',
    f'[{{"role": "system", "content": "As of 2026-08-19T11:47:31Z. {STABLE_PROMPT_BODY}"}}]',
]


def bursty(stats: CallSiteStats) -> CallSiteWarmth:
    """Warmth for a call site whose calls arrive close enough together to cache."""
    return CallSiteWarmth(total_call_count=stats.call_count, warm_call_count=stats.call_count * 0.9)


# Not caching: near-zero hit rate at eligible volume.
NOT_CACHING_STATS = CallSiteStats(
    agent_label="PR Review",
    agent_label_source=AgentLabelSource.AGENT_NAME,
    span_name="generate_content generate_structured",
    model="gemini-2.5-pro",
    call_count=169_000,
    sampled_call_count=169_000,
    sum_input_tokens=464_412_000,
    sum_cache_read_tokens=40_868,
    sum_cache_creation_tokens=0,
    avg_input_tokens=2_748,
)

# Healthy call site on the same model: the contrast anchor for NOT_CACHING_STATS.
ANCHOR_STATS = CallSiteStats(
    agent_label="Explorer",
    agent_label_source=AgentLabelSource.AGENT_NAME,
    span_name="generate_content gemini_generation",
    model="gemini-2.5-pro",
    call_count=21_000,
    sampled_call_count=21_000,
    sum_input_tokens=558_600_000,
    sum_cache_read_tokens=477_603_000,
    sum_cache_creation_tokens=0,
    avg_input_tokens=26_600,
)

# Thrash: cache writes vastly exceed reads.
THRASH_STATS = CallSiteStats(
    agent_label="Malicious Issue Detection",
    agent_label_source=AgentLabelSource.AGENT_NAME,
    span_name="generate_content anthropic_generation",
    model="claude-sonnet-5",
    call_count=2_805,
    sampled_call_count=2_805,
    sum_input_tokens=15_149_805,
    sum_cache_read_tokens=1_302_883,
    sum_cache_creation_tokens=13_940_848,
    avg_input_tokens=5_401,
)

# Ineligible: avg input below the cacheable minimum.
INELIGIBLE_STATS = CallSiteStats(
    agent_label="Supergroup Summarization",
    agent_label_source=AgentLabelSource.AGENT_NAME,
    span_name="generate_content generate_structured",
    model="gemini-3.1-flash-lite",
    call_count=1_760_000,
    sampled_call_count=1_760_000,
    sum_input_tokens=795_520_000,
    sum_cache_read_tokens=0,
    sum_cache_creation_tokens=0,
    avg_input_tokens=452,
)

# Instrumentation gap candidate: no cache attributes recorded at all.
GAP_STATS = CallSiteStats(
    agent_label="PR Review",
    agent_label_source=AgentLabelSource.AGENT_NAME,
    span_name="generate_content anthropic_web_search",
    model="claude-haiku-4-5",
    call_count=62_553,
    sampled_call_count=62_553,
    sum_input_tokens=2_203_429_425,
    sum_cache_read_tokens=0,
    sum_cache_creation_tokens=0,
    avg_input_tokens=35_225,
)

# Gemini never records zero cache values, so wholly-absent attributes on an
# eligible workload are a genuine 0% hit rate, not an instrumentation gap.
GEMINI_ZERO_STATS = CallSiteStats(
    agent_label="Lightweight RCA",
    agent_label_source=AgentLabelSource.AGENT_NAME,
    span_name="generate_content generate_structured",
    model="gemini-3.1-flash-lite",
    call_count=5_236_000,
    sampled_call_count=5_236_000,
    sum_input_tokens=15_006_376_000,
    sum_cache_read_tokens=0,
    sum_cache_creation_tokens=0,
    avg_input_tokens=2_866,
)


@patch("sentry.tasks.llm_cache_issue_detection.detect_llm_cache_issues_for_project.delay")
class RunLLMCacheIssueDetectionTest(TestCase):
    def create_agent_project(self, organization: Organization | None = None) -> Project:
        """A project that has sent gen-AI spans, i.e. one the fan-out prefilter keeps."""
        project = self.create_project(organization=organization or self.organization)
        project.update(flags=F("flags").bitor(Project.flags.has_insights_agent_monitoring))
        return project

    def dispatched_project_ids(self, mock_delay: MagicMock) -> set[int]:
        return {call.args[0] for call in mock_delay.call_args_list}

    def test_dispatches_sub_tasks_when_enabled(self, mock_delay: MagicMock) -> None:
        project = self.create_agent_project()

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            run_llm_cache_issue_detection()

        assert self.dispatched_project_ids(mock_delay) == {project.id}

    def test_skips_projects_without_agent_monitoring_spans(self, mock_delay: MagicMock) -> None:
        self.create_project()
        agent_project = self.create_agent_project()

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}):
            run_llm_cache_issue_detection()

        assert self.dispatched_project_ids(mock_delay) == {agent_project.id}

    def test_skips_when_detection_feature_disabled(self, mock_delay: MagicMock) -> None:
        self.create_agent_project()

        with self.feature({DETECTION_FEATURE: False, INGEST_FEATURE: True}):
            run_llm_cache_issue_detection()

        assert not mock_delay.called

    def test_dispatches_without_the_ingest_feature(self, mock_delay: MagicMock) -> None:
        # Ingest is enforced by the per-project task and again by the occurrence
        # consumer; the fan-out only decides whether an org is scanned at all.
        project = self.create_agent_project()

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: False}):
            run_llm_cache_issue_detection()

        assert self.dispatched_project_ids(mock_delay) == {project.id}

    def test_dispatches_across_multiple_batches(self, mock_delay: MagicMock) -> None:
        projects = [self.create_agent_project() for _ in range(3)]

        with (
            self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}),
            patch.object(llm_cache_issue_detection, "PROJECTS_PER_BATCH", 2),
            patch.object(
                Organization.objects,
                "filter",
                wraps=Organization.objects.filter,
            ) as mock_filter,
        ):
            run_llm_cache_issue_detection()

        # One organization lookup per batch: three projects at two per batch.
        assert mock_filter.call_count == 2
        assert self.dispatched_project_ids(mock_delay) == {project.id for project in projects}

    def test_evaluates_each_organization_once_per_batch(self, mock_delay: MagicMock) -> None:
        other_organization = self.create_organization()
        projects = [self.create_agent_project() for _ in range(3)]
        projects += [self.create_agent_project(organization=other_organization) for _ in range(2)]

        with patch.object(features, "has", return_value=True) as mock_has:
            run_llm_cache_issue_detection()

        # One evaluation per organization, not per project.
        assert mock_has.call_count == 2
        assert self.dispatched_project_ids(mock_delay) == {project.id for project in projects}


@patch("sentry.llm_cache_detection.issue_platform_adapter.produce_occurrence_to_kafka")
@patch("sentry.tasks.llm_cache_issue_detection.fetch_sample_calls")
@patch("sentry.tasks.llm_cache_issue_detection.count_spans_with_cache_attributes")
@patch("sentry.tasks.llm_cache_issue_detection.fetch_call_site_stats")
class DetectLLMCacheIssuesForProjectTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Warmth costs a query per candidate, so it is patched here rather than
        # carried on the stats. Which call sites the floors let through is
        # settled in the detection tests; these are about what the pipeline does
        # with one once they have.
        self.mock_fetch_warmth = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.fetch_call_site_warmth")
        )
        self.mock_fetch_warmth.side_effect = lambda project, stats, window: bursty(stats)
        # Prompt text is opt-in and usually absent, so the default here is a
        # query that ran and came back with nothing.
        self.mock_fetch_prompts = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.fetch_sample_prompts")
        )
        self.mock_fetch_prompts.return_value = []

    def enabled_features(self) -> AbstractContextManager[Any]:
        return self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True})

    def test_produces_occurrences_for_flagged_groups(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [
            THRASH_STATS,
            NOT_CACHING_STATS,
            ANCHOR_STATS,
            INELIGIBLE_STATS,
        ]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        # Both flagged groups have recorded cache activity: no gap probe needed.
        assert not mock_count_cache_attrs.called

        assert mock_produce.call_count == 2
        call_args_list = mock_produce.call_args_list

        for call in call_args_list:
            occurrence = call.kwargs["occurrence"]
            event_data = call.kwargs["event_data"]
            assert occurrence.type == LLMCacheUsageGroupType
            assert occurrence.project_id == project.id
            assert occurrence.level == "warning"
            assert occurrence.evidence_data["window_days"] == 7
            assert event_data["project_id"] == project.id
            assert event_data["contexts"]["trace"]["trace_id"] == SAMPLE_CALLS[0].trace_id

        # Sorted by severity descending: the not-caching group's uncached
        # tokens dwarf the thrash group's un-recouped cache writes.
        uncached_occurrence = call_args_list[0].kwargs["occurrence"]
        assert uncached_occurrence.issue_title == "Uncached LLM Prompts"
        assert uncached_occurrence.subtitle == (
            "PR Review | generate_content generate_structured | gemini-2.5-pro"
        )
        assert uncached_occurrence.culprit == "PR Review"
        assert uncached_occurrence.fingerprint == [create_fingerprint(NOT_CACHING_STATS)]
        evidence = uncached_occurrence.evidence_data
        assert evidence["call_count"] == 169_000
        assert evidence["hit_rate"] == pytest.approx(0.000088, rel=1e-2)
        assert evidence["avg_input_tokens"] == 2_748
        assert evidence["uncached_tokens"] == 464_371_132
        assert evidence["sum_input_tokens"] == 464_412_000
        assert evidence["sum_cache_read_tokens"] == 40_868
        assert evidence["sum_cache_creation_tokens"] == 0
        assert evidence["contrast_model"] == "gemini-2.5-pro"
        assert evidence["contrast_agent_label"] == "Explorer"
        assert evidence["contrast_hit_rate"] == pytest.approx(0.855)
        anchor_evidence = [
            e for e in uncached_occurrence.evidence_display if e.name == "Healthy comparison"
        ]
        assert len(anchor_evidence) == 1
        assert "gemini-2.5-pro" in anchor_evidence[0].value
        # Exactly one important row: integrations render only the first one,
        # so it must be the outcome's distinguishing number.
        important_names = [e.name for e in uncached_occurrence.evidence_display if e.important]
        assert important_names == ["Cache hit rate"]
        uncached_event_data = call_args_list[0].kwargs["event_data"]
        assert uncached_event_data["tags"]["gen_ai.agent.name"] == "PR Review"
        assert uncached_event_data["tags"]["gen_ai.request.model"] == "gemini-2.5-pro"

        thrash_occurrence = call_args_list[1].kwargs["occurrence"]
        assert thrash_occurrence.issue_title == "LLM Cache Thrash"
        assert thrash_occurrence.subtitle == (
            "Malicious Issue Detection | generate_content anthropic_generation | claude-sonnet-5"
        )
        assert thrash_occurrence.fingerprint == [create_fingerprint(THRASH_STATS)]
        evidence = thrash_occurrence.evidence_data
        assert evidence["write_read_ratio"] == pytest.approx(10.7, rel=1e-3)
        assert evidence["hit_rate"] == pytest.approx(0.086, rel=1e-2)
        # No same-model healthy call site: no contrast anchor attached.
        assert "contrast_model" not in evidence
        important_names = [e.name for e in thrash_occurrence.evidence_display if e.important]
        assert important_names == ["Cache write:read ratio"]

    def test_states_which_reading_each_finding_is(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # The title is copy and can be reworded; the outcome is the contract the
        # issue page renders from.
        project = self.create_project()
        mock_fetch_stats.return_value = [THRASH_STATS, NOT_CACHING_STATS, ANCHOR_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        outcomes = [
            call.kwargs["occurrence"].evidence_data["outcome"]
            for call in mock_produce.call_args_list
        ]
        assert outcomes == ["not_caching", "thrash"]

    def test_emits_how_much_of_the_traffic_could_have_cached(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # The hit rate is read against every call, so how many of them had a
        # warm cache to hit is what makes a low one a fault and not arithmetic.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert occurrence.evidence_data["warm_call_count"] == 152_100
        assert occurrence.evidence_data["cacheable_share"] == pytest.approx(0.9)
        eligible_rows = [
            evidence
            for evidence in occurrence.evidence_display
            if evidence.name == "Cache-eligible calls"
        ]
        assert [row.value for row in eligible_rows] == ["152,100 (90.00% of calls)"]

    def test_emits_the_window_it_measured(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        evidence = mock_produce.call_args.kwargs["occurrence"].evidence_data
        start = datetime.fromisoformat(evidence["window_start"])
        end = datetime.fromisoformat(evidence["window_end"])
        assert end - start == timedelta(days=evidence["window_days"])
        assert datetime.now(UTC) - end < timedelta(minutes=1)

    def test_emits_each_sample_call_for_deep_linking(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # A trace id alone lands on the trace; the span id and timestamp are what
        # land on the call within it.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        evidence = mock_produce.call_args.kwargs["occurrence"].evidence_data
        assert evidence["sample_traces"] == [
            {
                "trace_id": sample.trace_id,
                "span_id": sample.span_id,
                "timestamp": sample.timestamp,
                "input_tokens": sample.input_tokens,
                "cache_read_tokens": sample.cache_read_tokens,
                "cache_creation_tokens": sample.cache_creation_tokens,
            }
            for sample in SAMPLE_CALLS
        ]

    def test_emits_the_anchor_volume_alongside_its_hit_rate(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # A healthy comparison is only convincing if the reader can see it runs
        # at comparable volume.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS, ANCHOR_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        evidence = mock_produce.call_args.kwargs["occurrence"].evidence_data
        assert evidence["contrast_call_count"] == ANCHOR_STATS.call_count
        assert evidence["contrast_avg_input_tokens"] == ANCHOR_STATS.avg_input_tokens

    @patch("sentry.llm_cache_detection.pricing.ai_model_metadata_config")
    def test_prices_the_finding_when_the_model_costs_are_known(
        self,
        mock_metadata: MagicMock,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_metadata.return_value = {
            "version": 1,
            "models": {
                "gemini-2.5-pro": {
                    "costs": {
                        "inputPerToken": 0.00000125,
                        "outputPerToken": 0.00001,
                        "outputReasoningPerToken": 0.00001,
                        "inputCachedPerToken": 0.00000031,
                        "inputCacheWritePerToken": 0.000001563,
                    }
                }
            },
        }
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        # The pricebook is loaded once per run, not once per finding.
        assert mock_metadata.call_count == 1

        occurrence = mock_produce.call_args.kwargs["occurrence"]
        evidence = occurrence.evidence_data
        assert evidence["estimated_savings_usd"] == pytest.approx(
            NOT_CACHING_STATS.uncached_tokens * (0.00000125 - 0.00000031)
        )
        assert evidence["price_per_input_token"] == 0.00000125
        assert evidence["price_per_cached_input_token"] == 0.00000031
        assert evidence["price_per_cache_write_token"] == 0.000001563
        assert "Avoidable spend" in [row.name for row in occurrence.evidence_display]
        # Still exactly one important row: the money figure informs, the
        # diagnostic row is what integrations lead with.
        assert [row.name for row in occurrence.evidence_display if row.important] == [
            "Cache hit rate"
        ]

    def test_omits_pricing_when_the_model_is_unknown(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # No metadata is the normal case for air-gapped installs and self-hosted
        # models, so the finding has to stand on its token counts alone.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert "estimated_savings_usd" not in occurrence.evidence_data
        assert "Avoidable spend" not in [row.name for row in occurrence.evidence_display]

    def test_fingerprints_are_stable_across_runs(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS, ANCHOR_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == 2
        first, second = mock_produce.call_args_list
        assert first.kwargs["occurrence"].fingerprint == second.kwargs["occurrence"].fingerprint

    def test_subtitle_keeps_a_model_the_span_name_does_not_carry(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Hand-instrumented spans name themselves after the function they wrap,
        # so the model is only visible if the subtitle states it.
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(
                NOT_CACHING_STATS,
                agent_label="PR Review",
                span_name="generate_content generate_structured",
                model="gemini-2.5-pro",
            )
        ]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args_list[0].kwargs["occurrence"]
        assert occurrence.subtitle == (
            "PR Review | generate_content generate_structured | gemini-2.5-pro"
        )

    def test_subtitle_does_not_repeat_a_model_the_span_name_already_carries(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Every SDK gen-AI integration names the span "<operation> <model>", so
        # for auto-instrumented call sites -- the common case -- appending the
        # model again would spend the issue stream's width on a duplicate.
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(
                NOT_CACHING_STATS,
                agent_label="PR Review",
                span_name="chat claude-sonnet-5",
                model="claude-sonnet-5",
            )
        ]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args_list[0].kwargs["occurrence"]
        assert occurrence.subtitle == "PR Review | chat claude-sonnet-5"

    def test_subtitle_does_not_repeat_an_agent_the_span_name_already_carries(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Agent spans are named "<operation> <agent>", so for the call sites that
        # do carry an agent name -- the ones worth naming -- stating it twice
        # would spend the issue stream's width on a duplicate.
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(
                NOT_CACHING_STATS,
                agent_label="Lightweight RCA",
                span_name="invoke_agent Lightweight RCA",
                model="gemini-3.1-flash-lite",
            )
        ]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args_list[0].kwargs["occurrence"]
        assert occurrence.subtitle == "invoke_agent Lightweight RCA | gemini-3.1-flash-lite"

    def test_evidence_states_a_fallback_label_is_not_an_agent_name(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # An operation name shown under an "Agent" heading reads as an agent
        # someone named, and sends the reader looking for code that isn't there.
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(
                NOT_CACHING_STATS,
                agent_label="generate_content",
                agent_label_source=AgentLabelSource.OPERATION_NAME,
            )
        ]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args_list[0].kwargs["occurrence"]
        assert occurrence.evidence_data["agent_label_source"] == "gen_ai.operation.name"
        assert [
            evidence.value
            for evidence in occurrence.evidence_display
            if evidence.name == "Operation (no agent name)"
        ] == ["generate_content"]
        assert occurrence.evidence_data["agent_label"] == "generate_content"
        event_data = mock_produce.call_args_list[0].kwargs["event_data"]
        assert event_data["tags"] == {
            "gen_ai.operation.name": "generate_content",
            "gen_ai.request.model": "gemini-2.5-pro",
        }

    def test_fingerprints_distinguish_an_agent_from_an_operation_of_the_same_name(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Nothing stops an agent being named after the operation it runs. The
        # spans that carry no agent name are still a different call site.
        named = replace(NOT_CACHING_STATS, agent_label="generate_content")
        unnamed = replace(
            named,
            agent_label_source=AgentLabelSource.OPERATION_NAME,
        )
        assert create_fingerprint(named) != create_fingerprint(unnamed)

        project = self.create_project()
        mock_fetch_stats.return_value = [named, unnamed]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        fingerprints = {
            tuple(call.kwargs["occurrence"].fingerprint) for call in mock_produce.call_args_list
        }
        assert len(fingerprints) == 2

    def test_fingerprints_distinguish_call_sites_that_share_a_delimiter(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Hyphens are ordinary characters in an agent name and in a span name,
        # so two distinct call sites can agree on their concatenation. They must
        # still be two issues.
        first = replace(NOT_CACHING_STATS, agent_label="chat", span_name="stream-tokens")
        second = replace(NOT_CACHING_STATS, agent_label="chat-stream", span_name="tokens")
        assert create_fingerprint(first) != create_fingerprint(second)

        project = self.create_project()
        mock_fetch_stats.return_value = [first, second]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        fingerprints = {
            tuple(call.kwargs["occurrence"].fingerprint) for call in mock_produce.call_args_list
        }
        assert len(fingerprints) == 2

    def test_open_issues_do_not_consume_probe_budget(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Every candidate needs a probe, and the highest-severity ones already
        # have open issues. Probing those would spend the budget on outcomes
        # nothing reads, leaving the new candidates unresolvable.
        project = self.create_project()
        open_stats = [
            replace(GAP_STATS, agent_label=f"open-agent-{i}")
            for i in range(MAX_PRESENCE_PROBES_PER_PROJECT)
        ]
        new_stats = [replace(GAP_STATS, agent_label="new-agent")]
        mock_fetch_stats.return_value = open_stats + new_stats
        mock_fetch_traces.return_value = SAMPLE_CALLS
        mock_count_cache_attrs.return_value = 1_000

        for stats in open_stats:
            group = self.create_group(project=project)
            GroupHash.objects.create(
                project=project,
                group=group,
                hash=hash_fingerprint([create_fingerprint(stats)])[0],
            )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_count_cache_attrs.call_count == 1
        assert mock_produce.call_count == 1
        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert occurrence.fingerprint == [create_fingerprint(new_stats[0])]

    def test_gap_guard_suppresses_group_without_cache_attributes(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [GAP_STATS]
        mock_count_cache_attrs.return_value = 0
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_count_cache_attrs.call_count == 1
        assert not mock_produce.called

    def test_gap_probe_keeps_finding_when_attribute_recorded(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [GAP_STATS]
        mock_count_cache_attrs.return_value = 5
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == 1
        assert mock_produce.call_args.kwargs["occurrence"].issue_title == "Uncached LLM Prompts"

    def test_positive_only_reporter_flags_without_probe(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [GEMINI_ZERO_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert not mock_count_cache_attrs.called
        assert mock_produce.call_count == 1
        assert mock_produce.call_args.kwargs["occurrence"].issue_title == "Uncached LLM Prompts"

    def test_does_not_duplicate_existing_unresolved_issue(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        fingerprint = create_fingerprint(NOT_CACHING_STATS)
        group = self.create_group(project=project)
        GroupHash.objects.create(
            project=project, group=group, hash=hash_fingerprint([fingerprint])[0]
        )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert not mock_produce.called
        # No trace query is spent on an already-open issue.
        assert not mock_fetch_traces.called

    def test_does_not_reopen_an_issue_resolved_inside_the_window(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Detection runs hourly over a 7-day window, so for a week after someone
        # fixes and resolves a call site the aggregates still describe the old
        # code. The platform reads an occurrence against a resolved group as a
        # regression, so producing one would reopen the issue every hour.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        fingerprint = create_fingerprint(NOT_CACHING_STATS)
        group = self.create_group(
            project=project,
            status=GroupStatus.RESOLVED,
            first_seen=before_now(hours=2),
            resolved_at=before_now(minutes=5),
        )
        GroupHash.objects.create(
            project=project, group=group, hash=hash_fingerprint([fingerprint])[0]
        )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert not mock_produce.called

    def test_reopens_an_issue_resolved_before_the_window(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Once the window no longer reaches back to the resolution, the finding
        # is about traffic that postdates the fix -- a real regression.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        fingerprint = create_fingerprint(NOT_CACHING_STATS)
        group = self.create_group(
            project=project,
            status=GroupStatus.RESOLVED,
            first_seen=before_now(days=DETECTION_WINDOW_DAYS + 2),
            resolved_at=before_now(days=DETECTION_WINDOW_DAYS + 1),
        )
        GroupHash.objects.create(
            project=project, group=group, hash=hash_fingerprint([fingerprint])[0]
        )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == 1

    def test_does_not_resurrect_an_archived_issue(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # This type does not escalate, so archiving is the reader saying they
        # do not want to hear about this call site again.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        fingerprint = create_fingerprint(NOT_CACHING_STATS)
        group = self.create_group(project=project, status=GroupStatus.IGNORED)
        GroupHash.objects.create(
            project=project, group=group, hash=hash_fingerprint([fingerprint])[0]
        )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert not mock_produce.called

    def test_produces_occurrence_when_project_platform_is_none(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # A null platform fails the occurrence consumer's event schema, so the
        # occurrence must carry a valid fallback instead.
        project = self.create_project(platform=None)
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == 1
        assert mock_produce.call_args.kwargs["event_data"]["platform"] == "other"

    def test_caps_findings_per_project(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(NOT_CACHING_STATS, agent_label=f"agent-{i}")
            for i in range(FINDINGS_PER_PROJECT_LIMIT + 2)
        ]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == FINDINGS_PER_PROJECT_LIMIT

    def test_open_issues_do_not_consume_findings_cap(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # The top-severity candidates already have open issues; the cap must
        # leave room for the remaining new findings instead of being consumed
        # by dedupe rejects.
        project = self.create_project()
        open_stats = [
            replace(NOT_CACHING_STATS, agent_label=f"open-agent-{i}")
            for i in range(FINDINGS_PER_PROJECT_LIMIT)
        ]
        new_stats = [
            replace(NOT_CACHING_STATS, agent_label=f"new-agent-{i}")
            for i in range(FINDINGS_PER_PROJECT_LIMIT)
        ]
        mock_fetch_stats.return_value = open_stats + new_stats
        mock_fetch_traces.return_value = SAMPLE_CALLS

        for stats in open_stats:
            group = self.create_group(project=project)
            GroupHash.objects.create(
                project=project,
                group=group,
                hash=hash_fingerprint([create_fingerprint(stats)])[0],
            )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == FINDINGS_PER_PROJECT_LIMIT
        produced_agents = {
            call.kwargs["event_data"]["tags"]["gen_ai.agent.name"]
            for call in mock_produce.call_args_list
        }
        assert produced_agents == {stats.agent_label for stats in new_stats}

    def test_caps_presence_probes_per_project(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Every candidate needs a probe and every probe downgrades to UNKNOWN:
        # once the probe budget is spent, the rest resolve UNKNOWN unqueried.
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(GAP_STATS, agent_label=f"agent-{i}")
            for i in range(MAX_PRESENCE_PROBES_PER_PROJECT + 5)
        ]
        mock_count_cache_attrs.return_value = 0

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_count_cache_attrs.call_count == MAX_PRESENCE_PROBES_PER_PROJECT
        assert not mock_fetch_traces.called
        assert not mock_produce.called

    def test_does_not_file_a_call_site_whose_calls_arrive_too_far_apart(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Calls arriving alone meet a cold cache every time, so the low hit rate
        # is arithmetic and there is nothing to file. Settling that first also
        # spares the call site an instrumentation-gap probe it would otherwise
        # have earned by reporting no cache attributes at all.
        project = self.create_project()
        mock_fetch_stats.return_value = [GAP_STATS]
        self.mock_fetch_warmth.side_effect = lambda project, stats, window: CallSiteWarmth(
            total_call_count=stats.call_count, warm_call_count=stats.call_count * 0.1
        )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert self.mock_fetch_warmth.call_count == 1
        assert not mock_count_cache_attrs.called
        assert not mock_produce.called

    def test_says_where_the_sampled_prompts_stop_agreeing(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS
        self.mock_fetch_prompts.return_value = DIVERGING_PROMPTS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args.kwargs["occurrence"]
        evidence = occurrence.evidence_data
        assert evidence["prompt_sample_count"] == 2
        assert evidence["prompt_divergence_kind"] == "iso_timestamp"
        assert evidence["prompt_shortest_chars"] == len(DIVERGING_PROMPTS[0])
        assert evidence["prompt_stable_block_chars"] > evidence["prompt_common_prefix_chars"]
        assert evidence["prompt_template_misordered"] is True

        rows = {row.name: row.value for row in occurrence.evidence_display}
        assert rows["Prompts first differ at"] == "an ISO-8601 timestamp"
        assert "2 sampled prompts" in rows["Shared prompt prefix"]
        assert rows["Identical block after it"].endswith("chars")
        # The diagnosis is context, never the headline the integrations render.
        assert [row.name for row in occurrence.evidence_display if row.important] == [
            "Cache hit rate"
        ]

    def test_carries_no_prompt_text_into_the_occurrence(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Prompts are customer content. Everything the diagnosis reports about
        # them is a length, a count or the name of a pattern, and this asserts it
        # over the whole payload rather than the fields that happen to be read
        # above -- a leak would arrive through a field nobody thought to check.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS
        self.mock_fetch_prompts.return_value = DIVERGING_PROMPTS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        payload = json.dumps(mock_produce.call_args.kwargs["occurrence"].to_dict())
        assert "Summarize the rows below" not in payload
        assert "2026-08-19T10:15:00Z" not in payload
        for prompt in DIVERGING_PROMPTS:
            assert prompt not in payload

    def test_does_not_name_a_divergence_it_could_not_recognise(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # An unrecognised divergence is the residual of a handful of patterns, not
        # a finding: naming it would read as "not an id or a timestamp", which is
        # more than failing to match five regexes establishes. The lengths are
        # still worth reporting.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS
        self.mock_fetch_prompts.return_value = [
            f'[{{"role": "system", "content": "Summarize the incident. {STABLE_PROMPT_BODY}"}}]',
            f'[{{"role": "system", "content": "Summarize the outage. {STABLE_PROMPT_BODY}"}}]',
        ]

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert occurrence.evidence_data["prompt_divergence_kind"] == "other"

        rows = {row.name: row.value for row in occurrence.evidence_display}
        assert "Prompts first differ at" not in rows
        assert "2 sampled prompts" in rows["Shared prompt prefix"]

    def test_leaves_the_prompt_diagnosis_off_when_no_prompt_text_was_sent(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Sending prompts is opt-in and mostly off, so this is the ordinary path:
        # the finding is filed with the evidence it does have.
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS]
        mock_fetch_traces.return_value = SAMPLE_CALLS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        occurrence = mock_produce.call_args.kwargs["occurrence"]
        assert "prompt_divergence_kind" not in occurrence.evidence_data
        assert occurrence.evidence_data["hit_rate"] == pytest.approx(0.000088, rel=1e-2)
        assert not [
            row for row in occurrence.evidence_display if row.name.startswith("Shared prompt")
        ]

    def test_diagnoses_every_finding_it_files(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # The filing loop is already bounded by the findings cap, so the probe
        # needs no budget of its own and no finding is filed undiagnosed.
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(NOT_CACHING_STATS, agent_label=f"agent-{index}")
            for index in range(FINDINGS_PER_PROJECT_LIMIT)
        ]
        mock_fetch_traces.return_value = SAMPLE_CALLS
        self.mock_fetch_prompts.return_value = DIVERGING_PROMPTS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert self.mock_fetch_prompts.call_count == FINDINGS_PER_PROJECT_LIMIT
        assert mock_produce.call_count == FINDINGS_PER_PROJECT_LIMIT
        assert all(
            "prompt_divergence_kind" in call.kwargs["occurrence"].evidence_data
            for call in mock_produce.call_args_list
        )

    def test_bounds_the_warmth_probes_it_spends(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        # Every candidate is measured, so a project with more of them than the
        # budget leaves the rest unmeasured rather than running unbounded.
        project = self.create_project()
        mock_fetch_stats.return_value = [
            replace(NOT_CACHING_STATS, agent_label=f"agent-{i}")
            for i in range(MAX_WARMTH_PROBES_PER_PROJECT + 5)
        ]
        self.mock_fetch_warmth.side_effect = lambda project, stats, window: CallSiteWarmth(
            total_call_count=stats.call_count, warm_call_count=stats.call_count * 0.1
        )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert self.mock_fetch_warmth.call_count == MAX_WARMTH_PROBES_PER_PROJECT
        assert not mock_produce.called

    def test_skips_when_detection_feature_disabled(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()

        with self.feature({DETECTION_FEATURE: False, INGEST_FEATURE: True}):
            detect_llm_cache_issues_for_project(project.id)

        assert not mock_fetch_stats.called

    def test_skips_without_ingest_feature(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: False}):
            detect_llm_cache_issues_for_project(project.id)

        assert not mock_fetch_stats.called
