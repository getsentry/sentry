from __future__ import annotations

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.vcs.status_checks.size.tasks import (
    _get_candidate_metrics_for_rule,
    _get_matching_base_metric,
)
from sentry.preprod.vcs.status_checks.size.types import RuleArtifactType, StatusCheckRule
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class StatusCheckMetricSelectionHelpersTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team], organization=self.organization)

        self.artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
        )

    def _create_metric(
        self,
        metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType,
        identifier: str | None = None,
    ) -> PreprodArtifactSizeMetrics:
        return PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.artifact,
            metrics_artifact_type=metrics_artifact_type,
            identifier=identifier,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=100,
            max_download_size=200,
            min_install_size=300,
            max_install_size=400,
        )

    def test_get_candidate_metrics_for_rule_main_artifact(self) -> None:
        main_metric = self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        self._create_metric(PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT)
        self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="feature.alpha",
        )

        rule = StatusCheckRule(
            id="rule-main",
            metric="install_size",
            measurement="absolute",
            value=1000,
            artifact_type=RuleArtifactType.MAIN_ARTIFACT,
        )

        candidates = _get_candidate_metrics_for_rule(
            rule, list(PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=self.artifact))
        )

        assert candidates == [main_metric]

    def test_get_candidate_metrics_for_rule_all_artifacts_sorted(self) -> None:
        watch_b = self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch.b",
        )
        dynamic_a = self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            identifier="dynamic.a",
        )
        main = self._create_metric(PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT)
        watch_a = self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch.a",
        )

        rule = StatusCheckRule(
            id="rule-all",
            metric="install_size",
            measurement="absolute",
            value=1000,
            artifact_type=RuleArtifactType.ALL_ARTIFACTS,
        )

        candidates = _get_candidate_metrics_for_rule(rule, [watch_b, dynamic_a, main, watch_a])

        assert candidates == [main, watch_a, watch_b, dynamic_a]

    def test_get_matching_base_metric_matches_type_and_identifier(self) -> None:
        base_main = self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        base_watch = self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.app.watch",
        )
        candidate = PreprodArtifactSizeMetrics(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.app.watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=0,
            max_download_size=0,
            min_install_size=0,
            max_install_size=0,
        )

        matched = _get_matching_base_metric([base_main, base_watch], candidate)

        assert matched == base_watch

    def test_get_matching_base_metric_returns_none_when_identifier_differs(self) -> None:
        base_watch = self._create_metric(
            PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.app.watch",
        )
        candidate = PreprodArtifactSizeMetrics(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.app.watch.v2",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=0,
            max_download_size=0,
            min_install_size=0,
            max_install_size=0,
        )

        matched = _get_matching_base_metric([base_watch], candidate)

        assert matched is None
