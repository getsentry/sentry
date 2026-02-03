from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.utils import ComparisonValidationResult, can_compare_size_metrics
from sentry.testutils.cases import TestCase


class CanCompareSizeMetricsTest(TestCase):
    def test_can_compare_when_metrics_match(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is True
        assert result.error_message is None
        assert result.error_type is None

    def test_different_length_error_type(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                max_install_size=1000,
                max_download_size=500,
            ),
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                identifier="com.example.watch",
                max_install_size=200,
                max_download_size=100,
            ),
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_LENGTH
        assert result.error_message is not None
        assert "Head has 2 metric(s), base has 1 metric(s)" in result.error_message

    def test_different_app_ids_error_type(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app.debug",
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_APP_IDS
        assert result.error_message is not None
        assert "mismatched metrics" in result.error_message
        assert "com.example.app" in result.error_message
        assert "com.example.app.debug" in result.error_message

    def test_different_build_configurations_error_type(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                identifier="com.example.app",
                max_install_size=200,
                max_download_size=100,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert (
            result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_BUILD_CONFIGURATIONS
        )
        assert result.error_message is not None
        assert "mismatched metrics" in result.error_message

    def test_different_metrics_error_type(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                identifier="com.different.app",
                max_install_size=200,
                max_download_size=100,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_METRICS
        assert result.error_message is not None
        assert "mismatched metrics" in result.error_message
