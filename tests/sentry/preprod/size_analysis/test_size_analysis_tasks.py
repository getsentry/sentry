from unittest.mock import patch

from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.grouptype import PreprodSizeAnalysisGroupType
from sentry.preprod.size_analysis.models import ComparisonResults, SizeMetricDiffItem
from sentry.preprod.size_analysis.tasks import maybe_emit_issues
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MaybeEmitIssuesTest(TestCase):
    """Tests for the maybe_emit_issues function."""

    def _create_comparison_results(
        self,
        head_install_size: int = 5000000,
        head_download_size: int = 2000000,
        base_install_size: int = 4000000,
        base_download_size: int = 1500000,
    ) -> ComparisonResults:
        return ComparisonResults(
            diff_items=[],
            insight_diff_items=[],
            size_metric_diff_item=SizeMetricDiffItem(
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier=None,
                head_install_size=head_install_size,
                head_download_size=head_download_size,
                base_install_size=base_install_size,
                base_download_size=base_download_size,
            ),
            skipped_diff_item_comparison=False,
        )

    def test_maybe_emit_issues_triggers_detector_evaluation(self):
        head_artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        base_artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")

        head_metric = self.create_preprod_artifact_size_metrics(
            head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        base_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=4000000,
            max_download_size=1500000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="test-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute_threshold", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        comparison_results = self._create_comparison_results()

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues(comparison_results, head_metric, base_metric)

            assert mock_produce.call_count == 1

    def test_maybe_emit_issues_no_detectors(self):
        head_artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        base_artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")

        head_metric = self.create_preprod_artifact_size_metrics(
            head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        base_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=4000000,
            max_download_size=1500000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        comparison_results = self._create_comparison_results()

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues(comparison_results, head_metric, base_metric)

            assert mock_produce.call_count == 0

    def test_maybe_emit_issues_feature_flag_disabled(self):
        head_artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        base_artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")

        head_metric = self.create_preprod_artifact_size_metrics(
            head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        base_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=4000000,
            max_download_size=1500000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        comparison_results = self._create_comparison_results()

        with patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_produce:
            maybe_emit_issues(comparison_results, head_metric, base_metric)

        assert mock_produce.call_count == 0
