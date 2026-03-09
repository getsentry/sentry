from unittest.mock import patch

from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.webhooks import (
    build_webhook_payload,
    send_size_analysis_webhook,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class BuildWebhookPayloadTest(TestCase):
    """Tests for the build_webhook_payload function."""

    def _create_artifact_with_metrics(
        self,
        commit_comparison=None,
        artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        max_download_size=28311552,
        max_install_size=41943040,
        error_code=None,
        error_message=None,
        app_name="My App",
        build_version="2.4.1",
        build_number=347,
    ):
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=artifact_type,
            commit_comparison=commit_comparison,
            app_name=app_name,
            build_version=build_version,
            build_number=build_number,
        )
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=state,
            max_download_size=max_download_size,
            max_install_size=max_install_size,
            error_code=error_code,
            error_message=error_message,
        )
        return artifact, metric

    def test_standalone_build_success(self):
        """Standalone build with no comparison produces correct payload."""
        artifact, _ = self._create_artifact_with_metrics()

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["buildId"] == str(artifact.id)
        assert payload["status"] == "success"
        assert payload["errorCode"] is None
        assert payload["errorMessage"] is None
        assert payload["projectSlug"] == self.project.slug
        assert payload["platform"] == "apple"
        assert payload["artifactType"] == "xcarchive"
        assert payload["downloadSize"] == 28311552
        assert payload["installSize"] == 41943040
        assert payload["app"]["name"] == "My App"
        assert payload["app"]["version"] == "2.4.1"
        assert payload["app"]["buildNumber"] == 347
        assert payload["comparison"] is None
        assert payload["git"] is None

    def test_standalone_build_with_git_context(self):
        """Standalone build on main branch has git context but no comparison."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
            head_ref="main",
            base_ref="main",
            head_repo_name="acme/my-android-app",
            pr_number=None,
        )
        artifact, _ = self._create_artifact_with_metrics(
            commit_comparison=commit_comparison,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["status"] == "success"
        assert payload["platform"] == "android"
        assert payload["artifactType"] == "aab"
        assert payload["comparison"] is None
        assert payload["git"] is not None
        assert payload["git"]["headSha"] == "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1"
        assert payload["git"]["baseSha"] is not None
        assert payload["git"]["headRef"] == "main"
        assert payload["git"]["repoName"] == "acme/my-android-app"
        assert payload["git"]["prNumber"] is None

    def test_pr_build_comparison_succeeded(self):
        """PR build with successful comparison includes comparison data."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
            base_sha="f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9",
            head_ref="feature/new-onboarding",
            base_ref="main",
            head_repo_name="acme/my-ios-app",
            pr_number=1042,
        )
        head_artifact, head_metric = self._create_artifact_with_metrics(
            commit_comparison=commit_comparison,
            max_download_size=28311552,
            max_install_size=41943040,
        )

        base_artifact, base_metric = self._create_artifact_with_metrics(
            max_download_size=28259072,
            max_install_size=41864920,
        )

        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=head_metric,
            base_size_analysis=base_metric,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        payload = build_webhook_payload(head_artifact)

        assert payload is not None
        assert payload["status"] == "success"
        assert payload["comparison"] is not None
        assert payload["comparison"]["status"] == "success"
        assert payload["comparison"]["baseBuildId"] == str(base_artifact.id)
        assert payload["comparison"]["downloadSizeChange"] == 28311552 - 28259072
        assert payload["comparison"]["installSizeChange"] == 41943040 - 41864920
        assert payload["git"] is not None
        assert payload["git"]["prNumber"] == 1042

    def test_pr_build_comparison_failed(self):
        """PR build with failed comparison sets top-level status to error."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_ref="feature/new-onboarding",
            base_ref="main",
            head_repo_name="acme/my-ios-app",
            pr_number=1042,
        )
        head_artifact, head_metric = self._create_artifact_with_metrics(
            commit_comparison=commit_comparison,
        )
        base_artifact, base_metric = self._create_artifact_with_metrics()

        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=head_metric,
            base_size_analysis=base_metric,
            state=PreprodArtifactSizeComparison.State.FAILED,
        )

        payload = build_webhook_payload(head_artifact)

        assert payload is not None
        assert payload["status"] == "error"
        assert payload["errorCode"] is None
        assert payload["errorMessage"] is None
        assert payload["downloadSize"] == 28311552
        assert payload["installSize"] == 41943040
        assert payload["comparison"] is not None
        assert payload["comparison"]["status"] == "error"
        assert payload["comparison"]["baseBuildId"] == str(base_artifact.id)
        assert payload["comparison"]["downloadSizeChange"] is None
        assert payload["comparison"]["installSizeChange"] is None

    def test_analysis_failed(self):
        """Analysis failure produces error payload with error details."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_ref="feature/broken-build",
            base_ref="main",
            head_repo_name="acme/my-ios-app",
            pr_number=1050,
        )
        artifact, _ = self._create_artifact_with_metrics(
            commit_comparison=commit_comparison,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR,
            error_message="Failed to extract size metrics from artifact",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["status"] == "error"
        assert payload["errorCode"] == "PROCESSING_ERROR"
        assert payload["errorMessage"] == "Failed to extract size metrics from artifact"
        assert payload["downloadSize"] is None
        assert payload["installSize"] is None
        assert payload["comparison"] is None

    def test_analysis_timeout_error_code(self):
        """Timeout error code is mapped correctly."""
        artifact, _ = self._create_artifact_with_metrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.TIMEOUT,
            error_message="Size analysis timed out",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["errorCode"] == "TIMEOUT"

    def test_unsupported_artifact_error_code(self):
        """Unsupported artifact error code is mapped correctly."""
        artifact, _ = self._create_artifact_with_metrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.UNSUPPORTED_ARTIFACT,
            error_message="Unsupported artifact type",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["errorCode"] == "UNSUPPORTED_ARTIFACT"

    def test_not_ran_returns_none(self):
        """NOT_RAN state should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.NO_QUOTA,
            error_message="No quota available",
        )

        payload = build_webhook_payload(artifact)

        assert payload is None

    def test_pending_returns_none(self):
        """PENDING state should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        payload = build_webhook_payload(artifact)

        assert payload is None

    def test_processing_returns_none(self):
        """PROCESSING state should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )

        payload = build_webhook_payload(artifact)

        assert payload is None

    def test_no_main_metric_returns_none(self):
        """No main metric at all should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)

        payload = build_webhook_payload(artifact)

        assert payload is None

    def test_no_mobile_app_info(self):
        """Artifact without mobile app info has null app fields."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            create_mobile_app_info=False,
        )
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["app"]["name"] is None
        assert payload["app"]["version"] is None
        assert payload["app"]["buildNumber"] is None

    def test_build_id_is_string(self):
        """buildId should always be a string, not an integer."""
        artifact, _ = self._create_artifact_with_metrics()

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert isinstance(payload["buildId"], str)

    def test_android_apk_platform_and_type(self):
        """Android APK artifact has correct platform and type."""
        artifact, _ = self._create_artifact_with_metrics(
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["platform"] == "android"
        assert payload["artifactType"] == "apk"

    def test_android_aab_platform_and_type(self):
        """Android AAB artifact has correct platform and type."""
        artifact, _ = self._create_artifact_with_metrics(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["platform"] == "android"
        assert payload["artifactType"] == "aab"


@region_silo_test
class SendSizeAnalysisWebhookTest(TestCase):
    """Tests for the send_size_analysis_webhook function."""

    def _create_artifact_with_metrics(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_name="My App",
            build_version="1.0.0",
            build_number=1,
        )
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        return artifact

    @patch("sentry.preprod.size_analysis.webhooks.broadcast_webhooks_for_organization")
    def test_sends_webhook(self, mock_broadcast):
        """Webhook is sent for a completed build."""
        artifact = self._create_artifact_with_metrics()

        send_size_analysis_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_called_once()
        call_kwargs = mock_broadcast.delay.call_args
        assert call_kwargs.kwargs["resource_name"] == "size_analysis"
        assert call_kwargs.kwargs["event_name"] == "completed"
        assert call_kwargs.kwargs["organization_id"] == self.organization.id
        assert call_kwargs.kwargs["payload"]["buildId"] == str(artifact.id)
        assert call_kwargs.kwargs["payload"]["status"] == "success"

    @patch("sentry.preprod.size_analysis.webhooks.broadcast_webhooks_for_organization")
    def test_does_not_send_for_not_ran(self, mock_broadcast):
        """Webhook is NOT sent for NOT_RAN state."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.NO_QUOTA,
            error_message="No quota available",
        )

        send_size_analysis_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_not_called()

    @patch("sentry.preprod.size_analysis.webhooks.broadcast_webhooks_for_organization")
    def test_does_not_send_for_no_main_metric(self, mock_broadcast):
        """Webhook is NOT sent when no main metric exists."""
        artifact = self.create_preprod_artifact(project=self.project)

        send_size_analysis_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_not_called()

    @patch("sentry.preprod.size_analysis.webhooks.broadcast_webhooks_for_organization")
    def test_broadcast_exception_is_caught(self, mock_broadcast):
        """Exceptions from broadcast are caught and logged, not re-raised."""
        artifact = self._create_artifact_with_metrics()
        mock_broadcast.delay.side_effect = Exception("Celery task failed")

        # Should not raise
        send_size_analysis_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_called_once()
