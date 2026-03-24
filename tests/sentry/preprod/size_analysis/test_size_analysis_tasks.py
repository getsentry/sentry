from unittest.mock import patch

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.grouptype import (
    PreprodSizeAnalysisGroupType,
    _artifact_to_tags,
)
from sentry.preprod.size_analysis.models import ComparisonResults, SizeMetricDiffItem
from sentry.preprod.size_analysis.tasks import (
    _get_platform,
    maybe_emit_issues,
    maybe_emit_issues_from_absolute_size_results,
)
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
            comparison=500000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="test-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
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

    def test_maybe_emit_issues_populates_metadata(self):
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

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
            comparison=500000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="test-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        comparison_results = self._create_comparison_results()

        with self.feature("organizations:preprod-issues"):
            with patch("sentry.preprod.size_analysis.tasks.process_detectors") as mock_process:
                mock_process.return_value = {}
                maybe_emit_issues(comparison_results, head_metric, base_metric)

            assert mock_process.call_count == 1
            data_packet = mock_process.call_args[0][0]
            metadata = data_packet.packet["metadata"]

            assert metadata["platform"] == "android"
            assert metadata["head_metric_id"] == head_metric.id
            assert metadata["base_metric_id"] == base_metric.id
            assert metadata["head_artifact_id"] == head_artifact.id
            assert metadata["base_artifact_id"] == base_artifact.id
            assert metadata["head_artifact"].id == head_artifact.id
            assert metadata["base_artifact"].id == base_artifact.id

    def test_maybe_emit_issues_skips_absolute_detectors(self):
        """Absolute detectors should not fire from the comparison path."""
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
            name="absolute-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        comparison_results = self._create_comparison_results()

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues(comparison_results, head_metric, base_metric)

            assert mock_produce.call_count == 0


class MaybeEmitIssuesFromSizeResultsTest(TestCase):
    """Tests for the maybe_emit_issues_from_absolute_size_results function."""

    def test_triggers_absolute_detector(self):
        artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
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
            name="absolute-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues_from_absolute_size_results(head_metric=metric)

            assert mock_produce.call_count == 1

    def test_skips_diff_detectors(self):
        """Diff-based detectors should not fire from the single-build path."""
        artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_detector(
            name="diff-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues_from_absolute_size_results(head_metric=metric)

            assert mock_produce.call_count == 0

    def test_feature_flag_disabled(self):
        artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
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
            name="absolute-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_produce:
            maybe_emit_issues_from_absolute_size_results(head_metric=metric)

        assert mock_produce.call_count == 0

    def test_populates_metadata_without_base(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
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
            name="absolute-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        with self.feature("organizations:preprod-issues"):
            with patch("sentry.preprod.size_analysis.tasks.process_detectors") as mock_process:
                mock_process.return_value = {}
                maybe_emit_issues_from_absolute_size_results(head_metric=metric)

            assert mock_process.call_count == 1
            data_packet = mock_process.call_args[0][0]
            metadata = data_packet.packet["metadata"]

            assert metadata["platform"] == "android"
            assert metadata["head_metric_id"] == metric.id
            assert metadata["head_artifact_id"] == artifact.id
            assert metadata["head_artifact"].id == artifact.id
            assert "base_metric_id" not in metadata
            assert "base_artifact_id" not in metadata
            assert "base_artifact" not in metadata

    def test_no_detectors(self):
        artifact = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=5000000,
            max_download_size=2000000,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues_from_absolute_size_results(head_metric=metric)

            assert mock_produce.call_count == 0


class GetPlatformTest(TestCase):
    def _make_artifact(self, artifact_type):
        file = self.create_file(name="test", type="application/octet-stream")
        return self.create_preprod_artifact(
            project=self.project, file_id=file.id, artifact_type=artifact_type
        )

    def test_xcarchive_returns_apple(self):
        assert _get_platform(self._make_artifact(PreprodArtifact.ArtifactType.XCARCHIVE)) == "apple"

    def test_aab_returns_android(self):
        assert _get_platform(self._make_artifact(PreprodArtifact.ArtifactType.AAB)) == "android"

    def test_apk_returns_android(self):
        assert _get_platform(self._make_artifact(PreprodArtifact.ArtifactType.APK)) == "android"

    def test_none_returns_unknown(self):
        assert _get_platform(self._make_artifact(None)) == "unknown"


class ArtifactToTagsTest(TestCase):
    def test_full_artifact_data(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_name="MyApp",
            build_version="1.2.3",
            build_number=42,
        )
        # Refresh to load mobile_app_info
        artifact = PreprodArtifact.objects.select_related("mobile_app_info").get(id=artifact.id)

        tags = _artifact_to_tags(artifact)

        assert tags["app_id"] == "com.example.app"
        assert tags["app_name"] == "MyApp"
        assert tags["build_version"] == "1.2.3"
        assert tags["build_number"] == "42"
        assert tags["artifact_type"] == "apk"

    def test_minimal_artifact_data(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=None,
            create_mobile_app_info=False,
        )

        tags = _artifact_to_tags(artifact)

        assert tags == {"app_id": "com.example.app", "artifact_id": str(artifact.id)}
