from __future__ import annotations

from collections import Counter
from dataclasses import replace
from unittest import mock

from django.db.models import F

from sentry.ai_monitoring.issues.llm_cache_detection.detection import CallSiteStats
from sentry.ai_monitoring.issues.llm_cache_detection.pricing import PricingGap
from sentry.ai_monitoring.issues.llm_cache_detection.query import CallSiteQueryResult
from sentry.ai_monitoring.issues.llm_cache_detection.reporting import Disposition
from sentry.ai_monitoring.issues.llm_cache_detection.tasks import (
    DETECTION_CYCLE_DURATION,
    DETECTION_FEATURE,
    FINDINGS_PER_PROJECT_LIMIT,
    SCHEDULE_KEY,
    detect_llm_cache_issues_for_project,
    run_llm_cache_issue_detection,
)
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from tests.sentry.ai_monitoring.issues.llm_cache_detection.test_utils import make_stats

NOT_CACHING = make_stats(agent_label="Reviewer", hit_rate=0.001)
HEALTHY = make_stats(agent_label="Researcher", hit_rate=0.85)


def copies(stats: CallSiteStats, count: int) -> list[CallSiteStats]:
    return [
        replace(
            stats,
            agent_label=f"agent-{index}",
            sum_input_tokens=stats.sum_input_tokens * (count - index),
        )
        for index in range(count)
    ]


class RunDetectorTest(TestCase):
    @mock.patch("sentry.ai_monitoring.issues.llm_cache_detection.tasks.CursoredScheduler")
    def test_schedules_active_agent_projects(self, scheduler: mock.MagicMock) -> None:
        self.create_project()
        agent_project = self.create_project()
        agent_project.update(flags=F("flags").bitor(Project.flags.has_insights_agent_monitoring))

        run_llm_cache_issue_detection()

        kwargs = scheduler.call_args.kwargs
        assert kwargs["name"] == "llm_cache_issue_detection"
        assert kwargs["schedule_key"] == SCHEDULE_KEY
        assert kwargs["cycle_duration"] == DETECTION_CYCLE_DURATION
        assert kwargs["task"] is detect_llm_cache_issues_for_project
        assert set(kwargs["queryset"].values_list("id", flat=True)) == {agent_project.id}
        scheduler.return_value.tick.assert_called_once_with()


class DetectProjectTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        module = "sentry.ai_monitoring.issues.llm_cache_detection.tasks"
        self.fetch_stats = self.enterContext(mock.patch(f"{module}.fetch_call_site_stats"))
        self.resolve = self.enterContext(mock.patch(f"{module}.resolve_candidate"))
        self.resolve.side_effect = lambda _project, candidate, *_args: candidate
        self.fetch_samples = self.enterContext(mock.patch(f"{module}.fetch_sample_calls"))
        self.fetch_samples.return_value = []
        self.enterContext(mock.patch(f"{module}.ai_model_metadata_config", return_value=None))
        self.report = self.enterContext(mock.patch(f"{module}.report_project"))

    def test_ranks_candidates_caps_samples_and_reports_every_result(self) -> None:
        candidates = copies(NOT_CACHING, FINDINGS_PER_PROJECT_LIMIT + 2)
        self.fetch_stats.return_value = CallSiteQueryResult(
            call_sites=[*candidates, HEALTHY],
            dropped_calls=Counter(),
            truncated=False,
        )

        with self.feature(DETECTION_FEATURE):
            detect_llm_cache_issues_for_project(self.project.id)

        args = self.report.call_args.args
        non_candidates = args[3]
        reports = args[4]
        assert len(non_candidates) == 1
        assert [report.rank for report in reports] == list(range(1, len(candidates) + 1))
        assert [report.disposition for report in reports] == [
            *[Disposition.WOULD_CREATE] * FINDINGS_PER_PROJECT_LIMIT,
            Disposition.OVER_CAP,
            Disposition.OVER_CAP,
        ]
        assert all(report.pricing is PricingGap.NO_METADATA for report in reports)
        assert self.fetch_samples.call_count == FINDINGS_PER_PROJECT_LIMIT
        assert self.report.call_args.kwargs["warmth_probes_sent"] == 0

    def test_skips_disabled_project(self) -> None:
        detect_llm_cache_issues_for_project(self.project.id)

        assert not self.fetch_stats.called
