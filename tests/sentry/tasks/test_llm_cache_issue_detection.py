from collections import Counter
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.db.models import F

from sentry import features
from sentry.exceptions import InvalidSearchQuery
from sentry.llm_cache_detection.detection import CallSiteStats, CallSiteWarmth
from sentry.llm_cache_detection.query import CallSiteQueryResult, DroppedRowReason, SampleCall
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks import llm_cache_issue_detection
from sentry.tasks.llm_cache_issue_detection import (
    FINDINGS_PER_PROJECT_LIMIT,
    MAX_WARMTH_PROBES_PER_PROJECT,
    detect_llm_cache_issues_for_project,
    run_llm_cache_issue_detection,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.snuba_rpc import SnubaRPCError
from tests.sentry.llm_cache_detection.test_utils import make_stats

DETECTION_FEATURE = "organizations:llm-cache-detection"
INTERVAL_OPTION = "issue-detection.llm-cache-detection.interval-hours"
METRIC_PREFIX = "llm_cache_issue_detection."

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


# Invented prompts with a variable head in front of a stable body.
STABLE_PROMPT_BODY = "Summarize the rows below and cite each one.\n" * 100
DIVERGING_PROMPTS = [
    f'[{{"role": "system", "content": "As of 2026-08-19T10:15:00Z. {STABLE_PROMPT_BODY}"}}]',
    f'[{{"role": "system", "content": "As of 2026-08-19T11:47:31Z. {STABLE_PROMPT_BODY}"}}]',
]


def counted(mock_count: MagicMock, name: str) -> list[tuple[float, dict[str, Any]]]:
    return [
        (call.args[1], call.kwargs["attributes"])
        for call in mock_count.call_args_list
        if call.args[0] == METRIC_PREFIX + name
    ]


def bursty(stats: CallSiteStats) -> CallSiteWarmth:
    """Warmth for a call site whose calls arrive close enough together to cache."""
    return CallSiteWarmth(total_call_count=stats.call_count, warm_call_count=stats.call_count * 0.9)


def sparse(stats: CallSiteStats) -> CallSiteWarmth:
    """Warmth for a call site whose calls mostly arrive too far apart to cache."""
    return CallSiteWarmth(total_call_count=stats.call_count, warm_call_count=stats.call_count * 0.1)


# Not caching: near-zero hit rate at eligible volume.
NOT_CACHING_STATS = make_stats(
    agent_label="Reviewer",
    model="gemini-2.5-pro",
    call_count=100_000,
    avg_input_tokens=3_000,
    hit_rate=0.0001,
)

# Healthy call site on the same model: the contrast anchor for NOT_CACHING_STATS.
ANCHOR_STATS = make_stats(
    agent_label="Researcher",
    span_name="generate_content research",
    model="gemini-2.5-pro",
    call_count=20_000,
    avg_input_tokens=25_000,
    hit_rate=0.85,
)

# Thrash: cache writes vastly exceed reads.
THRASH_STATS = make_stats(
    agent_label="Classifier",
    span_name="generate_content classify",
    model="claude-sonnet-5",
    call_count=3_000,
    avg_input_tokens=5_000,
    hit_rate=0.08,
    write_read_ratio=12.0,
)

# Ineligible: avg input below the cacheable minimum.
INELIGIBLE_STATS = make_stats(
    agent_label="Tagger",
    model="gemini-3.1-flash-lite",
    call_count=200_000,
    avg_input_tokens=500,
)

# Instrumentation gap candidate: no cache attributes recorded at all.
GAP_STATS = make_stats(
    agent_label="Reviewer",
    span_name="generate_content web_search",
    model="claude-haiku-4-5",
    call_count=50_000,
    avg_input_tokens=30_000,
)

# Gemini never records zero cache values, so wholly-absent attributes on an
# eligible workload are a genuine 0% hit rate, not an instrumentation gap.
GEMINI_ZERO_STATS = make_stats(
    agent_label="Summarizer",
    model="gemini-3.1-flash-lite",
    call_count=500_000,
    avg_input_tokens=3_000,
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

    @patch("sentry_sdk.metrics.count")
    def test_skips_projects_without_agent_monitoring_spans(
        self, mock_count: MagicMock, mock_delay: MagicMock
    ) -> None:
        self.create_project()
        agent_project = self.create_agent_project()

        with self.feature({DETECTION_FEATURE: True}):
            run_llm_cache_issue_detection()

        assert self.dispatched_project_ids(mock_delay) == {agent_project.id}
        # A reason that skipped nothing is left out.
        assert counted(mock_count, "projects.skipped") == [(1, {"reason": "no_agent_spans"})]
        assert counted(mock_count, "projects.dispatched") == [(1, {})]

    @patch("sentry_sdk.metrics.count")
    def test_skips_when_detection_feature_disabled(
        self, mock_count: MagicMock, mock_delay: MagicMock
    ) -> None:
        self.create_agent_project()

        with self.feature({DETECTION_FEATURE: False}):
            run_llm_cache_issue_detection()

        assert not mock_delay.called
        assert counted(mock_count, "projects.skipped") == [(1, {"reason": "detection_disabled"})]
        # Reported at zero: the signal that nothing went out.
        assert counted(mock_count, "projects.dispatched") == [(0, {})]

    def test_dispatches_across_multiple_batches(self, mock_delay: MagicMock) -> None:
        projects = [self.create_agent_project() for _ in range(3)]

        with (
            self.feature({DETECTION_FEATURE: True}),
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

    @patch("sentry_sdk.metrics.count")
    def test_skips_the_ticks_between_runs(
        self, mock_count: MagicMock, mock_delay: MagicMock
    ) -> None:
        self.create_agent_project()
        # Midnight UTC is a whole number of days since the epoch.
        midnight = datetime(2025, 3, 1, tzinfo=UTC)

        with self.feature({DETECTION_FEATURE: True}), self.options({INTERVAL_OPTION: 24}):
            with freeze_time(midnight + timedelta(hours=5)):
                run_llm_cache_issue_detection()
            assert not mock_delay.called
            assert counted(mock_count, "fan_out.skipped") == [(1, {"reason": "interval"})]

            with freeze_time(midnight):
                run_llm_cache_issue_detection()
            assert mock_delay.call_count == 1

    def test_runs_every_tick_on_an_interval_below_one_hour(self, mock_delay: MagicMock) -> None:
        self.create_agent_project()

        with (
            self.feature({DETECTION_FEATURE: True}),
            self.options({INTERVAL_OPTION: 0}),
            freeze_time(datetime(2025, 3, 1, 5, tzinfo=UTC)),
        ):
            run_llm_cache_issue_detection()

        assert mock_delay.call_count == 1


GEMINI_PRO_COSTS = {
    "inputPerToken": 0.00000125,
    "outputPerToken": 0.00001,
    "outputReasoningPerToken": 0.00001,
    "inputCachedPerToken": 0.00000031,
    "inputCacheWritePerToken": 0.000001563,
}


def query_result(
    *call_sites: CallSiteStats,
    dropped_calls: dict[DroppedRowReason, int] | None = None,
    truncated: bool = False,
) -> CallSiteQueryResult:
    return CallSiteQueryResult(
        call_sites=list(call_sites),
        dropped_calls=Counter(dropped_calls or {}),
        truncated=truncated,
    )


def agents(stats: CallSiteStats, count: int) -> list[CallSiteStats]:
    """Distinct call sites shaped like ``stats``, in descending severity."""
    return [
        replace(
            stats,
            agent_label=f"agent-{index}",
            sum_input_tokens=stats.sum_input_tokens * (count - index),
        )
        for index in range(count)
    ]


class DetectLLMCacheIssuesForProjectTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.mock_fetch_stats = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.fetch_call_site_stats")
        )
        self.mock_fetch_warmth = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.fetch_call_site_warmth")
        )
        self.mock_fetch_warmth.side_effect = lambda project, stats, window: bursty(stats)
        self.mock_count_cache_attrs = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.count_spans_with_cache_attributes")
        )
        self.mock_fetch_samples = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.fetch_sample_calls")
        )
        self.mock_fetch_samples.return_value = SAMPLE_CALLS
        # Prompt text is opt-in and usually absent, so the default here is a
        # query that ran and came back with nothing.
        self.mock_fetch_prompts = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.fetch_sample_prompts")
        )
        self.mock_fetch_prompts.return_value = []
        self.mock_metadata = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.ai_model_metadata_config")
        )
        self.mock_metadata.return_value = None

        self.mock_report_logger = self.enterContext(
            patch("sentry.llm_cache_detection.reporting.logger")
        )
        self.mock_task_logger = self.enterContext(
            patch("sentry.tasks.llm_cache_issue_detection.logger")
        )
        self.mock_count = self.enterContext(patch("sentry_sdk.metrics.count"))
        self.mock_distribution = self.enterContext(patch("sentry_sdk.metrics.distribution"))

    def detect(self, *call_sites: CallSiteStats, **result: Any) -> None:
        self.mock_fetch_stats.return_value = query_result(*call_sites, **result)
        with self.feature({DETECTION_FEATURE: True}):
            detect_llm_cache_issues_for_project(self.project.id)

    def candidates(self) -> list[dict[str, Any]]:
        return [
            call.kwargs["extra"]
            for call in self.mock_report_logger.info.call_args_list
            if call.args[0] == "llm_cache_issue_detection.candidate_resolved"
        ]

    def candidate(self, stats: CallSiteStats) -> dict[str, Any]:
        (candidate,) = [
            candidate
            for candidate in self.candidates()
            if candidate["agent_label"] == stats.agent_label
            and candidate["span_name"] == stats.span_name
        ]
        return candidate

    def summary(self) -> dict[str, Any]:
        (summary,) = [
            call.kwargs["extra"]
            for call in self.mock_report_logger.info.call_args_list
            if call.args[0] == "llm_cache_issue_detection.project_processed"
        ]
        return summary

    def counted(self, name: str) -> list[tuple[float, dict[str, Any]]]:
        return counted(self.mock_count, name)

    def distributed(self, name: str) -> list[float]:
        return [
            call.args[1]
            for call in self.mock_distribution.call_args_list
            if call.args[0] == METRIC_PREFIX + name
        ]

    def test_reports_the_findings_it_would_file(self) -> None:
        self.detect(THRASH_STATS, NOT_CACHING_STATS, ANCHOR_STATS, INELIGIBLE_STATS)

        # Both flagged groups have recorded cache activity: no gap probe needed.
        assert not self.mock_count_cache_attrs.called

        # Only flagged call sites are candidates, ranked by severity.
        assert [(c["agent_label"], c["rank"]) for c in self.candidates()] == [
            (NOT_CACHING_STATS.agent_label, 1),
            (THRASH_STATS.agent_label, 2),
        ]

        not_caching = self.candidate(NOT_CACHING_STATS)
        assert not_caching["project_id"] == str(self.project.id)
        assert not_caching["organization_id"] == str(self.project.organization_id)
        assert not_caching["outcome"] == "not_caching"
        assert not_caching["reason"] == "cache_activity"
        assert not_caching["disposition"] == "would_create"
        assert not_caching["model"] == "gemini-2.5-pro"
        assert not_caching["agent_label_source"] == "gen_ai.agent.name"
        assert not_caching["call_count"] == 100_000
        assert not_caching["hit_rate"] == pytest.approx(0.0001)
        assert not_caching["uncached_tokens"] == pytest.approx(299_970_000)
        assert not_caching["cacheable_share"] == pytest.approx(0.9)
        assert not_caching["contrast_agent_label"] == "Researcher"
        assert not_caching["contrast_hit_rate"] == pytest.approx(0.85)
        assert not_caching["contrast_call_count"] == ANCHOR_STATS.call_count
        assert [sample["trace_id"] for sample in not_caching["sample_calls"]] == [
            sample.trace_id for sample in SAMPLE_CALLS
        ]
        window_start = datetime.fromisoformat(not_caching["window_start"])
        window_end = datetime.fromisoformat(not_caching["window_end"])
        assert window_end - window_start == timedelta(days=7)

        thrash = self.candidate(THRASH_STATS)
        assert thrash["outcome"] == "thrash"
        assert thrash["disposition"] == "would_create"
        assert thrash["write_read_ratio"] == pytest.approx(12.0)
        # No same-model healthy call site: no contrast anchor attached.
        assert "contrast_agent_label" not in thrash

        assert sorted(
            (attributes["outcome"], attributes["disposition"], attributes["has_anchor"])
            for _, attributes in self.counted("findings")
        ) == [("not_caching", "would_create", True), ("thrash", "would_create", False)]
        assert sorted(self.distributed("finding.call_count")) == [
            THRASH_STATS.call_count,
            NOT_CACHING_STATS.call_count,
        ]

    def test_tallies_every_call_site_by_outcome_and_reason(self) -> None:
        self.detect(THRASH_STATS, NOT_CACHING_STATS, ANCHOR_STATS, INELIGIBLE_STATS)

        assert sorted(
            (amount, attributes["outcome"], attributes["reason"], attributes["model"])
            for amount, attributes in self.counted("call_sites.classified")
        ) == [
            (1, "healthy", "cache_activity", "gemini-2.5-pro"),
            (1, "ineligible", "small_prompts", "gemini-3.1-flash-lite"),
            (1, "not_caching", "cache_activity", "gemini-2.5-pro"),
            (1, "thrash", "cache_activity", "claude-sonnet-5"),
        ]
        assert all(
            attributes["label_source"] == "gen_ai.agent.name"
            and attributes["project_id"] == str(self.project.id)
            for _, attributes in self.counted("call_sites.classified")
        )

        summary = self.summary()
        assert summary["call_site_count"] == 4
        assert summary["candidate_count"] == 2
        assert summary["finding_count"] == 2
        assert summary["dispositions"] == {"would_create": 2}
        assert summary["outcome_reasons"] == {
            "healthy:cache_activity": 1,
            "ineligible:small_prompts": 1,
            "not_caching:cache_activity": 1,
            "thrash:cache_activity": 1,
        }
        assert summary["warmth_probes_sent"] == 2

    def test_reports_findings_past_the_cap_as_over_cap(self) -> None:
        self.detect(*agents(NOT_CACHING_STATS, FINDINGS_PER_PROJECT_LIMIT + 2))

        dispositions = [candidate["disposition"] for candidate in self.candidates()]
        assert dispositions == ["would_create"] * FINDINGS_PER_PROJECT_LIMIT + ["over_cap"] * 2

        # Only what would be filed is sampled, which keeps the queries to what
        # filing will cost.
        assert self.mock_fetch_samples.call_count == FINDINGS_PER_PROJECT_LIMIT
        assert self.mock_fetch_prompts.call_count == FINDINGS_PER_PROJECT_LIMIT
        over_cap = self.candidates()[-1]
        assert "sample_calls" not in over_cap
        assert "prompt_diagnosis_gap" not in over_cap
        # Pricing costs no query, so every finding carries it.
        assert all("pricing_gap" in candidate for candidate in self.candidates())

    def test_resolves_zero_cache_tokens_without_attributes_as_unknown(self) -> None:
        self.mock_count_cache_attrs.return_value = 0

        self.detect(GAP_STATS)

        candidate = self.candidate(GAP_STATS)
        assert candidate["initial_outcome"] == "not_caching"
        assert candidate["initial_reason"] == "zero_cache_tokens"
        assert candidate["outcome"] == "unknown"
        assert candidate["reason"] == "no_cache_attributes"
        assert candidate["spans_with_cache_attributes"] == 0
        assert candidate["disposition"] is None
        assert not self.mock_fetch_samples.called
        assert not self.counted("findings")

    def test_keeps_a_finding_whose_spans_record_explicit_zeros(self) -> None:
        self.mock_count_cache_attrs.return_value = 500

        self.detect(GAP_STATS)

        candidate = self.candidate(GAP_STATS)
        assert candidate["outcome"] == "not_caching"
        assert candidate["reason"] == "explicit_zero_cache_tokens"
        assert candidate["spans_with_cache_attributes"] == 500
        assert candidate["disposition"] == "would_create"

    def test_keeps_a_positive_only_reporter_without_probing(self) -> None:
        self.detect(GEMINI_ZERO_STATS)

        assert not self.mock_count_cache_attrs.called
        candidate = self.candidate(GEMINI_ZERO_STATS)
        assert candidate["reason"] == "positive_only_reporter"
        assert candidate["disposition"] == "would_create"
        assert "spans_with_cache_attributes" not in candidate

    def test_reports_candidates_left_unmeasured_once_the_warmth_budget_is_spent(self) -> None:
        self.detect(*agents(NOT_CACHING_STATS, MAX_WARMTH_PROBES_PER_PROJECT + 3))

        assert self.mock_fetch_warmth.call_count == MAX_WARMTH_PROBES_PER_PROJECT
        unmeasured = self.candidates()[MAX_WARMTH_PROBES_PER_PROJECT:]
        assert [(c["outcome"], c["reason"], c["warmth_gap"]) for c in unmeasured] == [
            ("ineligible", "budget_exhausted", "budget_exhausted")
        ] * 3

    def test_does_not_flag_a_call_site_whose_calls_arrive_too_far_apart(self) -> None:
        # Settled before the presence probe, which it makes unnecessary.
        self.mock_fetch_warmth.side_effect = lambda project, stats, window: sparse(stats)

        self.detect(GAP_STATS)

        assert not self.mock_count_cache_attrs.called
        candidate = self.candidate(GAP_STATS)
        assert candidate["outcome"] == "ineligible"
        assert candidate["reason"] == "low_cacheable_share"
        assert candidate["cacheable_share"] == pytest.approx(0.1)

    def test_does_not_charge_the_budget_for_an_unqueryable_call_site(self) -> None:
        self.mock_fetch_warmth.side_effect = None
        self.mock_fetch_warmth.return_value = None

        self.detect(NOT_CACHING_STATS)

        candidate = self.candidate(NOT_CACHING_STATS)
        assert candidate["outcome"] == "ineligible"
        assert candidate["reason"] == "unqueryable_call_site"
        assert self.summary()["warmth_probes_sent"] == 0

    def test_carries_on_past_a_probe_that_failed(self) -> None:
        first, second = agents(NOT_CACHING_STATS, 2)
        self.mock_fetch_warmth.side_effect = [SnubaRPCError("timed out"), bursty(second)]

        self.detect(first, second)

        failed = self.candidate(first)
        assert failed["outcome"] == "ineligible"
        assert failed["reason"] == "probe_failed"
        assert self.candidate(second)["disposition"] == "would_create"
        assert [attributes for _, attributes in self.counted("probe_failed")] == [
            {
                "probe": "warmth",
                "error": "SnubaRPCError",
                "project_id": str(self.project.id),
                "organization_id": str(self.project.organization_id),
            }
        ]
        assert self.summary()["warmth_probes_sent"] == 2

    def test_files_a_finding_whose_sample_calls_could_not_be_read(self) -> None:
        self.mock_fetch_samples.side_effect = InvalidSearchQuery("bad term")

        self.detect(NOT_CACHING_STATS)

        candidate = self.candidate(NOT_CACHING_STATS)
        assert candidate["disposition"] == "would_create"
        assert candidate["sample_calls_gap"] == "probe_failed"
        assert [attributes["probe"] for _, attributes in self.counted("probe_failed")] == [
            "sample_calls"
        ]

    def test_files_a_finding_whose_sample_calls_could_not_be_queried(self) -> None:
        self.mock_fetch_samples.return_value = None

        self.detect(NOT_CACHING_STATS)

        candidate = self.candidate(NOT_CACHING_STATS)
        assert candidate["disposition"] == "would_create"
        assert candidate["sample_calls_gap"] == "unqueryable_call_site"
        assert "sample_calls" not in candidate

    def test_prices_the_finding_when_the_model_costs_are_known(self) -> None:
        self.mock_metadata.return_value = {
            "version": 1,
            "models": {"gemini-2.5-pro": {"costs": GEMINI_PRO_COSTS}},
        }

        self.detect(NOT_CACHING_STATS, replace(NOT_CACHING_STATS, agent_label="Other"))

        # The pricebook is loaded once per run, not once per finding.
        assert self.mock_metadata.call_count == 1
        expected_savings = NOT_CACHING_STATS.uncached_tokens * (0.00000125 - 0.00000031)
        candidate = self.candidate(NOT_CACHING_STATS)
        assert candidate["estimated_savings_usd"] == pytest.approx(expected_savings)
        assert candidate["price_per_input_token"] == 0.00000125
        assert "pricing_gap" not in candidate
        assert (
            self.distributed("finding.estimated_savings_usd")
            == [pytest.approx(expected_savings)] * 2
        )
        assert {attributes["result"] for _, attributes in self.counted("pricing")} == {"priced"}

    def test_reports_why_a_finding_could_not_be_priced(self) -> None:
        self.mock_metadata.return_value = {"version": 1, "models": {}}

        self.detect(NOT_CACHING_STATS)

        assert self.candidate(NOT_CACHING_STATS)["pricing_gap"] == "unknown_model"
        assert [attributes for _, attributes in self.counted("pricing")] == [
            {"result": "unknown_model", "model": "gemini-2.5-pro"}
        ]
        assert not self.distributed("finding.estimated_savings_usd")

    def test_says_where_the_sampled_prompts_stop_agreeing(self) -> None:
        self.mock_fetch_prompts.return_value = DIVERGING_PROMPTS

        self.detect(NOT_CACHING_STATS)

        candidate = self.candidate(NOT_CACHING_STATS)
        assert candidate["prompt_sample_count"] == 2
        assert candidate["prompt_divergence_kind"] == "iso_timestamp"
        assert candidate["prompt_shortest_prompt_chars"] == len(DIVERGING_PROMPTS[0])
        assert candidate["prompt_stable_block_chars"] > candidate["prompt_common_prefix_chars"]
        assert candidate["prompt_template_misordered"] is True
        assert [attributes for _, attributes in self.counted("prompt_diagnosis")] == [
            {"result": "diagnosed", "kind": "iso_timestamp", "template_misordered": True}
        ]

    def test_carries_no_prompt_text_into_its_output(self) -> None:
        # Checked over everything emitted: a leak would come through a field
        # nobody thought to check.
        self.mock_fetch_prompts.return_value = DIVERGING_PROMPTS

        self.detect(NOT_CACHING_STATS)

        emitted = repr(
            [
                mock.mock_calls
                for mock in (
                    self.mock_report_logger,
                    self.mock_task_logger,
                    self.mock_count,
                    self.mock_distribution,
                )
            ]
        )
        assert "Summarize the rows below" not in emitted
        assert "2026-08-19T10:15:00Z" not in emitted

    def test_reports_a_call_site_that_sent_no_prompt_text(self) -> None:
        self.detect(NOT_CACHING_STATS)

        assert self.candidate(NOT_CACHING_STATS)["prompt_diagnosis_gap"] == "no_prompt_text"
        assert [attributes for _, attributes in self.counted("prompt_diagnosis")] == [
            {"result": "no_prompt_text"}
        ]

    def test_reports_a_call_site_with_too_few_prompts_to_compare(self) -> None:
        self.mock_fetch_prompts.return_value = DIVERGING_PROMPTS[:1]

        self.detect(NOT_CACHING_STATS)

        assert self.candidate(NOT_CACHING_STATS)["prompt_diagnosis_gap"] == "too_few_samples"

    def test_keeps_prompt_text_out_of_a_failed_diagnosis(self) -> None:
        # Neither an escaping traceback nor the failure log may carry the prompts.
        self.mock_fetch_prompts.return_value = DIVERGING_PROMPTS

        with patch(
            "sentry.tasks.llm_cache_issue_detection.diagnose_prompt_divergence",
            side_effect=ValueError(DIVERGING_PROMPTS[0]),
        ):
            self.detect(NOT_CACHING_STATS)

        assert self.candidate(NOT_CACHING_STATS)["prompt_diagnosis_gap"] == "failed"
        (failure,) = [
            call
            for call in self.mock_task_logger.warning.call_args_list
            if call.args[0] == "llm_cache_issue_detection.prompt_diagnosis_failed"
        ]
        assert failure.kwargs == {"extra": {"project_id": self.project.id, "error": "ValueError"}}

    def test_reports_what_the_aggregate_could_not_attribute(self) -> None:
        self.detect(
            NOT_CACHING_STATS,
            dropped_calls={DroppedRowReason.NO_MODEL: 1_200, DroppedRowReason.NO_LABEL: 30},
            truncated=True,
        )

        assert sorted(
            (amount, attributes["reason"]) for amount, attributes in self.counted("calls_dropped")
        ) == [(30, "no_label"), (1_200, "no_model")]
        assert len(self.counted("call_sites.truncated")) == 1
        summary = self.summary()
        assert summary["truncated"] is True
        assert summary["dropped_calls"] == {"no_model": 1_200, "no_label": 30}

    def test_flags_cache_tokens_exceeding_the_input_they_belong_to(self) -> None:
        # THRASH_STATS reads and writes more cache tokens than it reports input.
        self.detect(THRASH_STATS, NOT_CACHING_STATS)

        assert [
            (amount, attributes["model"])
            for amount, attributes in self.counted("call_sites.cache_exceeds_input")
        ] == [(1, "claude-sonnet-5")]
        assert self.candidate(THRASH_STATS)["cache_exceeds_input"] is True
        assert self.candidate(NOT_CACHING_STATS)["cache_exceeds_input"] is False
        assert self.summary()["cache_exceeds_input_count"] == 1

    def test_reports_a_project_with_nothing_to_flag(self) -> None:
        self.detect(ANCHOR_STATS)

        assert self.candidates() == []
        assert self.summary()["call_site_count"] == 1
        assert not self.mock_fetch_warmth.called

    def test_skips_when_detection_feature_disabled(self) -> None:
        with self.feature({DETECTION_FEATURE: False}):
            detect_llm_cache_issues_for_project(self.project.id)

        assert not self.mock_fetch_stats.called
        assert self.counted("projects.skipped") == [(1, {"reason": "detection_disabled"})]
