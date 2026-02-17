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
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is True
        assert result.error_message is None
        assert result.error_type is None

    def test_cannot_compare_empty_lists(self):
        result = can_compare_size_metrics([], [])

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_LENGTH
        assert result.error_message is not None
        assert "no completed size metrics" in result.error_message

    def test_cannot_compare_empty_head(self):
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics([], base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_LENGTH
        assert result.error_message is not None

    def test_cannot_compare_empty_base(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            )
        ]

        result = can_compare_size_metrics(head_metrics, [])

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_LENGTH
        assert result.error_message is not None

    def test_different_length_error_type(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            ),
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                identifier="com.example.watch",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=200,
                max_download_size=100,
            ),
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
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
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app.debug",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
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
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
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

    def test_cannot_compare_when_metrics_not_completed(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.NOT_ALL_COMPLETED
        assert result.error_message is not None
        assert "not completed" in result.error_message

    def test_cannot_compare_when_all_metrics_pending(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.NOT_ALL_COMPLETED
        assert result.error_message is not None
        assert "2 metric(s)" in result.error_message

    def test_cannot_compare_when_metric_failed(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.METRICS_FAILED
        assert result.error_message is not None
        assert "failed" in result.error_message

    def test_cannot_compare_when_metric_not_ran(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.METRICS_FAILED
        assert result.error_message is not None
        assert "failed" in result.error_message

    def test_failed_takes_priority_over_pending(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
                max_install_size=900,
                max_download_size=450,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.METRICS_FAILED

    def test_different_metrics_error_type(self):
        head_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=1,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                identifier="com.example.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=1000,
                max_download_size=500,
            )
        ]
        base_metrics = [
            PreprodArtifactSizeMetrics(
                preprod_artifact_id=2,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                identifier="com.different.app",
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                max_install_size=200,
                max_download_size=100,
            )
        ]

        result = can_compare_size_metrics(head_metrics, base_metrics)

        assert result.can_compare is False
        assert result.error_type == ComparisonValidationResult.ErrorType.DIFFERENT_METRICS
        assert result.error_message is not None
        assert "mismatched metrics" in result.error_message
