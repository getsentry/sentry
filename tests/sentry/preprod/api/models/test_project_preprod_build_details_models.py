from __future__ import annotations

import pytest

from sentry.preprod.api.models.project_preprod_build_details_models import (
    SizeInfoCompleted,
    SizeInfoFailed,
    SizeInfoPending,
    SizeInfoProcessing,
    to_size_info,
)
from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestToSizeInfo(TestCase):
    def test_to_size_info_none_input(self):
        """Test to_size_info returns None when given None input."""
        result = to_size_info([])
        assert result is None

    def test_to_size_info_pending_state(self):
        """Test to_size_info returns SizeInfoPending for PENDING state."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING
        )

        result = to_size_info(list([size_metrics]))

        assert isinstance(result, SizeInfoPending)
        assert result.state == PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING

    def test_to_size_info_processing_state(self):
        """Test to_size_info returns SizeInfoProcessing for PROCESSING state."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
        )

        result = to_size_info(list([size_metrics]))

        assert isinstance(result, SizeInfoProcessing)
        assert result.state == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING

    def test_to_size_info_completed_state(self):
        """Test to_size_info returns SizeInfoCompleted for COMPLETED state."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            max_install_size=1024000,
            max_download_size=512000,
        )

        result = to_size_info(list([size_metrics]))

        assert isinstance(result, SizeInfoCompleted)
        assert result.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
        assert result.install_size_bytes == 1024000
        assert result.download_size_bytes == 512000

    def test_to_size_info_completed_state_with_multiple_metrics(self):
        """Test to_size_info returns SizeInfoCompleted for COMPLETED state with multiple metrics."""
        size_metrics = [
            PreprodArtifactSizeMetrics(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                max_install_size=1024000,
                max_download_size=512000,
            ),
            PreprodArtifactSizeMetrics(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
                max_install_size=512000,
                max_download_size=256000,
            ),
        ]

        result = to_size_info(size_metrics)

        assert isinstance(result, SizeInfoCompleted)
        assert result.install_size_bytes == 1024000
        assert result.download_size_bytes == 512000
        assert len(result.size_metrics) == 2
        assert (
            result.size_metrics[0].metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert result.size_metrics[0].install_size_bytes == 1024000
        assert result.size_metrics[0].download_size_bytes == 512000
        assert (
            result.size_metrics[1].metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT
        )
        assert result.size_metrics[1].install_size_bytes == 512000
        assert result.size_metrics[1].download_size_bytes == 256000

    def test_to_size_info_completed_state_with_base_metrics(self):
        """Test to_size_info includes base size metrics when provided."""
        size_metrics = [
            PreprodArtifactSizeMetrics(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                max_install_size=1024000,
                max_download_size=512000,
            ),
        ]
        base_size_metrics = [
            PreprodArtifactSizeMetrics(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                max_install_size=512000,
                max_download_size=256000,
            ),
        ]

        result = to_size_info(size_metrics, base_size_metrics)

        assert isinstance(result, SizeInfoCompleted)
        assert len(result.base_size_metrics) == 1
        base_metric = result.base_size_metrics[0]
        assert (
            base_metric.metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert base_metric.install_size_bytes == 512000
        assert base_metric.download_size_bytes == 256000

    def test_to_size_info_failed_state(self):
        """Test to_size_info returns SizeInfoFailed for FAILED state."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.TIMEOUT,
            error_message="Analysis timed out after 30 minutes",
        )

        result = to_size_info(list([size_metrics]))

        assert isinstance(result, SizeInfoFailed)
        assert result.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
        assert result.error_code == PreprodArtifactSizeMetrics.ErrorCode.TIMEOUT
        assert result.error_message == "Analysis timed out after 30 minutes"

    def test_to_size_info_failed_state_with_different_error_codes(self):
        """Test to_size_info handles different error codes correctly."""
        error_cases = [
            (PreprodArtifactSizeMetrics.ErrorCode.UNKNOWN, "Unknown error occurred"),
            (
                PreprodArtifactSizeMetrics.ErrorCode.UNSUPPORTED_ARTIFACT,
                "Artifact type not supported",
            ),
            (PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR, "Processing failed"),
        ]

        for error_code, error_message in error_cases:
            size_metrics = PreprodArtifactSizeMetrics(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
                error_code=error_code,
                error_message=error_message,
            )

            result = to_size_info(list([size_metrics]))

            assert isinstance(result, SizeInfoFailed)
            assert result.error_code == error_code
            assert result.error_message == error_message

    def test_to_size_info_completed_with_zero_sizes(self):
        """Test to_size_info handles completed state with zero sizes."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            max_install_size=0,
            max_download_size=0,
        )

        result = to_size_info(list([size_metrics]))

        assert isinstance(result, SizeInfoCompleted)
        assert result.install_size_bytes == 0
        assert result.download_size_bytes == 0

    def test_to_size_info_completed_with_large_sizes(self):
        """Test to_size_info handles completed state with large file sizes."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            max_install_size=5000000000,  # ~5GB
            max_download_size=2000000000,  # ~2GB
        )

        result = to_size_info(list([size_metrics]))

        assert isinstance(result, SizeInfoCompleted)
        assert result.install_size_bytes == 5000000000
        assert result.download_size_bytes == 2000000000

    def test_to_size_info_invalid_state_raises_error(self):
        """Test to_size_info raises ValueError for unknown state."""
        size_metrics = PreprodArtifactSizeMetrics(state=999)  # Invalid state

        with pytest.raises(ValueError, match="Unknown SizeAnalysisState 999"):
            to_size_info(list([size_metrics]))

    def test_to_size_info_completed_state_missing_size_fields(self):
        """Test to_size_info raises ValueError when COMPLETED state has None size fields."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            max_install_size=None,
            max_download_size=None,
        )

        with pytest.raises(
            ValueError, match="COMPLETED state requires both max_install_size and max_download_size"
        ):
            to_size_info(list([size_metrics]))

    def test_to_size_info_failed_state_no_error_code(self):
        """Test to_size_info raises ValueError when FAILED state has only error_code."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=None,
            error_message="Processing failed",
        )

        with pytest.raises(
            ValueError, match="FAILED state requires both error_code and error_message"
        ):
            to_size_info(list([size_metrics]))

    def test_to_size_info_failed_state_no_error_message(self):
        """Test to_size_info raises ValueError when FAILED state has only error_message."""
        size_metrics = PreprodArtifactSizeMetrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR,
            error_message=None,
        )

        with pytest.raises(
            ValueError, match="FAILED state requires both error_code and error_message"
        ):
            to_size_info(list([size_metrics]))
