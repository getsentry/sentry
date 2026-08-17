from contextlib import AbstractContextManager
from dataclasses import replace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.db.models import F

from sentry.issues.grouptype import LLMCacheUsageGroupType
from sentry.issues.ingest import hash_fingerprint
from sentry.llm_cache_detection.detection import CacheOutcome, CallSiteStats
from sentry.llm_cache_detection.issue_platform_adapter import create_fingerprint
from sentry.models.grouphash import GroupHash
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks import llm_cache_issue_detection
from sentry.tasks.llm_cache_issue_detection import (
    FINDINGS_PER_PROJECT_LIMIT,
    MAX_PRESENCE_PROBES_PER_PROJECT,
    detect_llm_cache_issues_for_project,
    run_llm_cache_issue_detection,
)
from sentry.testutils.cases import TestCase

INGEST_FEATURE = LLMCacheUsageGroupType.build_ingest_feature_name()
DETECTION_FEATURE = "organizations:llm-cache-detection"

SAMPLE_TRACE_IDS = ["a" * 32, "b" * 32]

# Not caching: near-zero hit rate at eligible volume.
NOT_CACHING_STATS = CallSiteStats(
    transaction="seer.code_review.pr_review_step.pr_review_task",
    span_description="generate_content generate_structured",
    model="gemini-2.5-pro",
    call_count=169_000,
    sum_input_tokens=464_412_000,
    sum_cache_read_tokens=40_868,
    sum_cache_creation_tokens=0,
    avg_input_tokens=2_748,
)

# Healthy call site on the same model: the contrast anchor for NOT_CACHING_STATS.
ANCHOR_STATS = CallSiteStats(
    transaction="seer.automation.agent.explorer_main_task",
    span_description="generate_content gemini_generation",
    model="gemini-2.5-pro",
    call_count=21_000,
    sum_input_tokens=558_600_000,
    sum_cache_read_tokens=477_603_000,
    sum_cache_creation_tokens=0,
    avg_input_tokens=26_600,
)

# Thrash: cache writes vastly exceed reads.
THRASH_STATS = CallSiteStats(
    transaction="/v1/automation/malicious-issue-detection/classify",
    span_description="generate_content anthropic_generation",
    model="claude-sonnet-5",
    call_count=2_805,
    sum_input_tokens=15_149_805,
    sum_cache_read_tokens=1_302_883,
    sum_cache_creation_tokens=13_940_848,
    avg_input_tokens=5_401,
)

# Ineligible: avg input below the cacheable minimum.
INELIGIBLE_STATS = CallSiteStats(
    transaction="seer.automation.summarization.supergroup_summarization",
    span_description="generate_content generate_structured",
    model="gemini-3.1-flash-lite",
    call_count=1_760_000,
    sum_input_tokens=795_520_000,
    sum_cache_read_tokens=0,
    sum_cache_creation_tokens=0,
    avg_input_tokens=452,
)

# Instrumentation gap candidate: no cache attributes recorded at all.
GAP_STATS = CallSiteStats(
    transaction="seer.code_review.pr_review_step.pr_review_task",
    span_description="generate_content anthropic_web_search",
    model="claude-haiku-4-5",
    call_count=62_553,
    sum_input_tokens=2_203_429_425,
    sum_cache_read_tokens=0,
    sum_cache_creation_tokens=0,
    avg_input_tokens=35_225,
)

# Gemini never records zero cache values, so wholly-absent attributes on an
# eligible workload are a genuine 0% hit rate, not an instrumentation gap.
GEMINI_ZERO_STATS = CallSiteStats(
    transaction="seer.automation.lightweight_rca",
    span_description="generate_content generate_structured",
    model="gemini-3.1-flash-lite",
    call_count=5_236_000,
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

    def test_skips_without_ingest_feature(self, mock_delay: MagicMock) -> None:
        self.create_agent_project()

        with self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: False}):
            run_llm_cache_issue_detection()

        assert not mock_delay.called

    def test_dispatches_across_multiple_batches(self, mock_delay: MagicMock) -> None:
        projects = [self.create_agent_project() for _ in range(3)]

        with (
            self.feature({DETECTION_FEATURE: True, INGEST_FEATURE: True}),
            patch.object(llm_cache_issue_detection, "PROJECTS_PER_BATCH", 2),
            patch.object(
                llm_cache_issue_detection,
                "_dispatch_detection_for_projects",
                wraps=llm_cache_issue_detection._dispatch_detection_for_projects,
            ) as mock_dispatch,
        ):
            run_llm_cache_issue_detection()

        assert [len(call.args[0]) for call in mock_dispatch.call_args_list] == [2, 1]
        assert self.dispatched_project_ids(mock_delay) == {project.id for project in projects}

    def test_evaluates_each_organization_once_per_batch(self, mock_delay: MagicMock) -> None:
        other_organization = self.create_organization()
        projects = [self.create_agent_project() for _ in range(3)]
        projects += [self.create_agent_project(organization=other_organization) for _ in range(2)]

        with patch.object(llm_cache_issue_detection.features, "has", return_value=True) as mock_has:
            run_llm_cache_issue_detection()

        # Two evaluations per organization (detection plus ingest), not per project.
        assert mock_has.call_count == 4
        assert self.dispatched_project_ids(mock_delay) == {project.id for project in projects}


@patch("sentry.llm_cache_detection.issue_platform_adapter.produce_occurrence_to_kafka")
@patch("sentry.tasks.llm_cache_issue_detection.fetch_sample_trace_ids")
@patch("sentry.tasks.llm_cache_issue_detection.count_spans_with_cache_attributes")
@patch("sentry.tasks.llm_cache_issue_detection.fetch_call_site_stats")
class DetectLLMCacheIssuesForProjectTest(TestCase):
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
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

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
            assert occurrence.evidence_data["sample_trace_ids"] == SAMPLE_TRACE_IDS
            assert event_data["project_id"] == project.id
            assert event_data["contexts"]["trace"]["trace_id"] == SAMPLE_TRACE_IDS[0]

        # Sorted by severity descending: the not-caching group's uncached
        # tokens dwarf the thrash group's un-recouped cache writes.
        uncached_occurrence = call_args_list[0].kwargs["occurrence"]
        assert uncached_occurrence.issue_title == "Uncached LLM Prompts"
        assert uncached_occurrence.subtitle == (
            "seer.code_review.pr_review_step.pr_review_task | "
            "generate_content generate_structured | gemini-2.5-pro"
        )
        assert uncached_occurrence.culprit == "seer.code_review.pr_review_step.pr_review_task"
        assert uncached_occurrence.fingerprint == [
            create_fingerprint(CacheOutcome.NOT_CACHING, NOT_CACHING_STATS)
        ]
        evidence = uncached_occurrence.evidence_data
        assert evidence["call_count"] == 169_000
        assert evidence["hit_rate"] == pytest.approx(0.000088, rel=1e-2)
        assert evidence["avg_input_tokens"] == 2_748
        assert evidence["uncached_tokens"] == 464_371_132
        assert evidence["sum_input_tokens"] == 464_412_000
        assert evidence["sum_cache_read_tokens"] == 40_868
        assert evidence["sum_cache_creation_tokens"] == 0
        assert evidence["contrast_model"] == "gemini-2.5-pro"
        assert evidence["contrast_transaction"] == "seer.automation.agent.explorer_main_task"
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
        assert (
            uncached_event_data["tags"]["transaction"]
            == "seer.code_review.pr_review_step.pr_review_task"
        )
        assert uncached_event_data["tags"]["gen_ai.request.model"] == "gemini-2.5-pro"

        thrash_occurrence = call_args_list[1].kwargs["occurrence"]
        assert thrash_occurrence.issue_title == "LLM Cache Thrash"
        assert thrash_occurrence.subtitle == (
            "/v1/automation/malicious-issue-detection/classify | "
            "generate_content anthropic_generation | claude-sonnet-5"
        )
        assert thrash_occurrence.fingerprint == [
            create_fingerprint(CacheOutcome.THRASH, THRASH_STATS)
        ]
        evidence = thrash_occurrence.evidence_data
        assert evidence["write_read_ratio"] == pytest.approx(10.7, rel=1e-3)
        assert evidence["hit_rate"] == pytest.approx(0.086, rel=1e-2)
        # No same-model healthy call site: no contrast anchor attached.
        assert "contrast_model" not in evidence
        important_names = [e.name for e in thrash_occurrence.evidence_display if e.important]
        assert important_names == ["Cache write:read ratio"]

    def test_fingerprints_are_stable_across_runs(
        self,
        mock_fetch_stats: MagicMock,
        mock_count_cache_attrs: MagicMock,
        mock_fetch_traces: MagicMock,
        mock_produce: MagicMock,
    ) -> None:
        project = self.create_project()
        mock_fetch_stats.return_value = [NOT_CACHING_STATS, ANCHOR_STATS]
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == 2
        first, second = mock_produce.call_args_list
        assert first.kwargs["occurrence"].fingerprint == second.kwargs["occurrence"].fingerprint

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
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

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
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

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
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

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
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

        fingerprint = create_fingerprint(CacheOutcome.NOT_CACHING, NOT_CACHING_STATS)
        group = self.create_group(project=project)
        GroupHash.objects.create(
            project=project, group=group, hash=hash_fingerprint([fingerprint])[0]
        )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert not mock_produce.called
        # No trace query is spent on an already-open issue.
        assert not mock_fetch_traces.called

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
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

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
            replace(NOT_CACHING_STATS, transaction=f"task-{i}")
            for i in range(FINDINGS_PER_PROJECT_LIMIT + 2)
        ]
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

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
            replace(NOT_CACHING_STATS, transaction=f"open-task-{i}")
            for i in range(FINDINGS_PER_PROJECT_LIMIT)
        ]
        new_stats = [
            replace(NOT_CACHING_STATS, transaction=f"new-task-{i}")
            for i in range(FINDINGS_PER_PROJECT_LIMIT)
        ]
        mock_fetch_stats.return_value = open_stats + new_stats
        mock_fetch_traces.return_value = SAMPLE_TRACE_IDS

        for stats in open_stats:
            group = self.create_group(project=project)
            GroupHash.objects.create(
                project=project,
                group=group,
                hash=hash_fingerprint([create_fingerprint(CacheOutcome.NOT_CACHING, stats)])[0],
            )

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_produce.call_count == FINDINGS_PER_PROJECT_LIMIT
        produced_transactions = {
            call.kwargs["event_data"]["tags"]["transaction"] for call in mock_produce.call_args_list
        }
        assert produced_transactions == {stats.transaction for stats in new_stats}

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
            replace(GAP_STATS, transaction=f"task-{i}")
            for i in range(MAX_PRESENCE_PROBES_PER_PROJECT + 5)
        ]
        mock_count_cache_attrs.return_value = 0

        with self.enabled_features():
            detect_llm_cache_issues_for_project(project.id)

        assert mock_count_cache_attrs.call_count == MAX_PRESENCE_PROBES_PER_PROJECT
        assert not mock_fetch_traces.called
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
