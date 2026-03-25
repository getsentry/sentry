from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.grouptype import (
    PreprodSizeAnalysisGroupType,
    _artifact_to_tags,
)
from sentry.preprod.size_analysis.tasks import (
    _get_platform,
    maybe_emit_issues_from_absolute_size_results,
    maybe_emit_issues_from_diff_size_results,
)
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MaybeEmitIssuesFromDiffSizeResultsTest(TestCase):
    """Tests for the maybe_emit_issues_from_diff_size_results function."""

    def _create_artifact_with_metrics(
        self,
        max_install_size=5000000,
        max_download_size=2000000,
        date_added=None,
        app_name=None,
        **kwargs,
    ):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            date_added=date_added,
            app_name=app_name,
            **kwargs,
        )
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=max_install_size,
            max_download_size=max_download_size,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        return artifact

    def _create_diff_detector(self, threshold_type="absolute_diff", comparison=500000, **kwargs):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=comparison,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        config = {"threshold_type": threshold_type, "measurement": "install_size", **kwargs}
        return self.create_detector(
            name="test-detector",
            project=self.project,
            type=PreprodSizeAnalysisGroupType.slug,
            config=config,
            workflow_condition_group=condition_group,
        )

    def test_triggers_detector_evaluation(self):
        now = timezone.now()
        self._create_artifact_with_metrics(
            max_install_size=4000000,
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            max_install_size=5000000,
            date_added=now - timedelta(hours=1),
        )
        self._create_diff_detector()

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues_from_diff_size_results(head, self.organization.id)

            assert mock_produce.call_count == 1

    def test_no_detectors(self):
        now = timezone.now()
        self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues_from_diff_size_results(head, self.organization.id)

            assert mock_produce.call_count == 0

    def test_feature_flag_disabled(self):
        now = timezone.now()
        self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))
        self._create_diff_detector()

        with patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_produce:
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert mock_produce.call_count == 0

    def test_populates_metadata(self):
        now = timezone.now()
        base = self._create_artifact_with_metrics(
            max_install_size=4000000,
            max_download_size=1500000,
            date_added=now - timedelta(hours=2),
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        head = self._create_artifact_with_metrics(
            max_install_size=5000000,
            max_download_size=2000000,
            date_added=now - timedelta(hours=1),
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        self._create_diff_detector()

        with self.feature("organizations:preprod-issues"):
            with patch("sentry.preprod.size_analysis.tasks.process_detectors") as mock_process:
                mock_process.return_value = {}
                maybe_emit_issues_from_diff_size_results(head, self.organization.id)

            assert mock_process.call_count == 1
            data_packet = mock_process.call_args[0][0]
            packet = data_packet.packet
            metadata = packet["metadata"]

            assert metadata["platform"] == "android"
            assert metadata["head_artifact_id"] == head.id
            assert metadata["base_artifact_id"] == base.id
            assert metadata["head_artifact"].id == head.id
            assert metadata["base_artifact"].id == base.id
            assert packet["head_install_size_bytes"] == 5000000
            assert packet["head_download_size_bytes"] == 2000000
            assert packet["base_install_size_bytes"] == 4000000
            assert packet["base_download_size_bytes"] == 1500000

    def test_skips_absolute_detectors(self):
        now = timezone.now()
        self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

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
                maybe_emit_issues_from_diff_size_results(head, self.organization.id)

            assert mock_produce.call_count == 0

    def test_skips_when_no_base(self):
        head = self._create_artifact_with_metrics()
        self._create_diff_detector()

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues_from_diff_size_results(head, self.organization.id)

            assert mock_produce.call_count == 0

    def test_skips_when_no_head_metrics(self):
        head = self.create_preprod_artifact(project=self.project, app_id="com.example.app")
        self._create_diff_detector()

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
            ) as mock_produce:
                maybe_emit_issues_from_diff_size_results(head, self.organization.id)

            assert mock_produce.call_count == 0

    def test_batches_queries(self):
        now = timezone.now()
        self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        # Two detectors with the same (empty) query
        self._create_diff_detector(threshold_type="absolute_diff")
        self._create_diff_detector(threshold_type="relative_diff")

        with self.feature("organizations:preprod-issues"):
            with patch(
                "sentry.preprod.size_analysis.tasks.get_sequential_base_artifact"
            ) as mock_lookup:
                mock_lookup.return_value = None
                maybe_emit_issues_from_diff_size_results(head, self.organization.id)

            # Should only be called once for the shared empty query
            assert mock_lookup.call_count == 1

    def test_creates_comparison_record(self):
        now = timezone.now()
        self._create_artifact_with_metrics(
            max_install_size=4000000,
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            max_install_size=5000000,
            date_added=now - timedelta(hours=1),
        )
        self._create_diff_detector()

        with self.feature("organizations:preprod-issues"):
            maybe_emit_issues_from_diff_size_results(head, self.organization.id)

        assert PreprodArtifactSizeComparison.objects.count() == 1
        comparison = PreprodArtifactSizeComparison.objects.first()
        assert comparison is not None


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
