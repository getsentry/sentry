from io import BytesIO
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
from sentry.utils import json


class BuildWebhookPayloadTest(TestCase):
    """Tests for the build_webhook_payload function.

    The webhook payload must be a strict subset of the public Size Analysis API
    response, excluding ``insights``, ``appComponents``,
    ``comparisons[].diffItems``, and ``comparisons[].insightDiffItems``.
    """

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _create_analysis_file(self, data):
        f = self.create_file(name="analysis.json", type="application/json")
        f.putfile(BytesIO(json.dumps(data).encode()))
        return f

    def _make_analysis_data(self, **overrides):
        defaults = {
            "analysis_duration": 1.5,
            "download_size": 28311552,
            "install_size": 41943040,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }
        defaults.update(overrides)
        return defaults

    def _make_comparison_data(
        self, head_sizes, base_sizes, metrics_artifact_type=0, identifier=None
    ):
        return {
            "diff_items": [{"size_diff": 100, "path": "/test", "type": "added"}],
            "insight_diff_items": [],
            "size_metric_diff_item": {
                "metrics_artifact_type": metrics_artifact_type,
                "identifier": identifier,
                "head_install_size": head_sizes[1],
                "head_download_size": head_sizes[0],
                "base_install_size": base_sizes[1],
                "base_download_size": base_sizes[0],
            },
            "skipped_diff_item_comparison": False,
        }

    def _create_artifact_with_completed_analysis(
        self,
        commit_comparison=None,
        artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        app_name="My App",
        build_version="2.4.1",
        build_number=347,
        download_size=28311552,
        install_size=41943040,
        app_id="com.example.myapp",
        analysis_data_overrides=None,
    ):
        """Create an artifact with a COMPLETED main metric backed by an analysis file."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=artifact_type,
            commit_comparison=commit_comparison,
            app_name=app_name,
            build_version=build_version,
            build_number=build_number,
            app_id=app_id,
        )
        analysis_data = self._make_analysis_data(
            download_size=download_size,
            install_size=install_size,
            **(analysis_data_overrides or {}),
        )
        analysis_file = self._create_analysis_file(analysis_data)
        metric = self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_download_size=download_size,
            max_install_size=install_size,
            analysis_file_id=analysis_file.id,
        )
        return artifact, metric

    def _assert_no_api_heavy_fields(self, payload):
        """Assert that API-only heavy fields are absent."""
        for field in ("insights", "appComponents"):
            assert field not in payload, f"API-only field '{field}' should not be present"

    # ------------------------------------------------------------------
    # Completed standalone builds
    # ------------------------------------------------------------------

    def test_standalone_build_success(self):
        """Completed standalone build produces API-subset payload."""
        artifact, _ = self._create_artifact_with_completed_analysis()

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["buildId"] == str(artifact.id)
        assert payload["organizationSlug"] == self.organization.slug
        assert payload["projectSlug"] == self.project.slug
        assert payload["platform"] == "APPLE"
        assert payload["state"] == "COMPLETED"
        assert payload["errorCode"] is None
        assert payload["errorMessage"] is None
        assert payload["downloadSize"] == 28311552
        assert payload["installSize"] == 41943040
        assert payload["analysisDuration"] == 1.5
        assert payload["analysisVersion"] == "1.0.0"

        # appInfo matches canonical shape
        assert payload["appInfo"]["name"] == "My App"
        assert payload["appInfo"]["version"] == "2.4.1"
        assert payload["appInfo"]["buildNumber"] == 347
        assert payload["appInfo"]["artifactType"] == "XCARCHIVE"
        assert payload["appInfo"]["appId"] == "com.example.myapp"
        assert payload["appInfo"]["dateAdded"] is not None

        # No comparison or base
        assert payload["baseBuildId"] is None
        assert payload["baseAppInfo"] is None
        assert payload["comparisons"] is None
        assert payload["gitInfo"] is None

        self._assert_no_api_heavy_fields(payload)

    def test_standalone_build_with_git_context(self):
        """Standalone build on main branch has gitInfo but no comparison."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
            head_ref="main",
            base_ref="main",
            head_repo_name="acme/my-android-app",
            pr_number=None,
        )
        artifact, _ = self._create_artifact_with_completed_analysis(
            commit_comparison=commit_comparison,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "COMPLETED"
        assert payload["organizationSlug"] == self.organization.slug
        assert payload["platform"] == "ANDROID"
        assert payload["appInfo"]["artifactType"] == "AAB"
        assert payload["comparisons"] is None
        assert payload["gitInfo"] is not None
        assert payload["gitInfo"]["headSha"] == "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1"
        assert payload["gitInfo"]["headRef"] == "main"
        assert payload["gitInfo"]["headRepoName"] == "acme/my-android-app"
        assert payload["gitInfo"]["prNumber"] is None
        assert payload["gitInfo"]["provider"] is not None

        self._assert_no_api_heavy_fields(payload)

    # ------------------------------------------------------------------
    # PR builds with comparisons
    # ------------------------------------------------------------------

    def test_pr_build_comparison_succeeded(self):
        """PR build with successful comparison includes per-artifact comparisons."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
            base_sha="f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9",
            head_ref="feature/new-onboarding",
            base_ref="main",
            head_repo_name="acme/my-ios-app",
            pr_number=1042,
        )
        head_artifact, head_metric = self._create_artifact_with_completed_analysis(
            commit_comparison=commit_comparison,
            download_size=28311552,
            install_size=41943040,
        )

        # Create base artifact reachable via commit comparison chain
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha=commit_comparison.base_sha,
            base_sha="0000000000000000000000000000000000000000",
        )
        base_artifact, base_metric = self._create_artifact_with_completed_analysis(
            commit_comparison=base_commit_comparison,
            download_size=28259072,
            install_size=41864920,
        )

        comparison_data = self._make_comparison_data(
            head_sizes=(28311552, 41943040),
            base_sizes=(28259072, 41864920),
        )
        comparison_file = self._create_analysis_file(comparison_data)
        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=head_metric,
            base_size_analysis=base_metric,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=comparison_file.id,
        )

        payload = build_webhook_payload(head_artifact)

        assert payload is not None
        assert payload["state"] == "COMPLETED"
        assert payload["baseBuildId"] == str(base_artifact.id)
        assert payload["baseAppInfo"] is not None
        assert payload["baseAppInfo"]["name"] == "My App"
        assert payload["comparisons"] is not None
        assert len(payload["comparisons"]) == 1

        comparison = payload["comparisons"][0]
        assert comparison["metricsArtifactType"] == "MAIN_ARTIFACT"
        assert comparison["state"] == "SUCCESS"
        assert comparison["errorCode"] is None
        assert comparison["errorMessage"] is None
        assert comparison["sizeMetricDiff"] is not None
        assert comparison["sizeMetricDiff"]["headDownloadSize"] == 28311552
        assert comparison["sizeMetricDiff"]["baseDownloadSize"] == 28259072

        # Webhook comparisons must NOT contain heavy diff fields
        assert "diffItems" not in comparison
        assert "insightDiffItems" not in comparison

        assert payload["gitInfo"] is not None
        assert payload["gitInfo"]["prNumber"] == 1042

        self._assert_no_api_heavy_fields(payload)

    def test_pr_build_comparison_failed(self):
        """PR build with failed comparison: top-level state stays COMPLETED."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_ref="feature/new-onboarding",
            base_ref="main",
            head_repo_name="acme/my-ios-app",
            pr_number=1042,
        )
        head_artifact, head_metric = self._create_artifact_with_completed_analysis(
            commit_comparison=commit_comparison,
        )

        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha=commit_comparison.base_sha,
            base_sha="0000000000000000000000000000000000000000",
        )
        _base_artifact, base_metric = self._create_artifact_with_completed_analysis(
            commit_comparison=base_commit_comparison,
        )

        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=head_metric,
            base_size_analysis=base_metric,
            state=PreprodArtifactSizeComparison.State.FAILED,
        )

        payload = build_webhook_payload(head_artifact)

        assert payload is not None
        # Top-level state is COMPLETED (analysis itself succeeded)
        assert payload["state"] == "COMPLETED"
        assert payload["errorCode"] is None
        assert payload["errorMessage"] is None
        assert payload["downloadSize"] == 28311552
        assert payload["installSize"] == 41943040

        # Comparison row shows the failure
        assert payload["comparisons"] is not None
        assert len(payload["comparisons"]) == 1
        assert payload["comparisons"][0]["state"] == "FAILED"

    def test_multi_metric_comparison(self):
        """Multiple artifacts (main + watch) produce multiple comparison entries."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
            base_sha="f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9",
            head_ref="feature/watch-app",
            base_ref="main",
            head_repo_name="acme/my-ios-app",
            pr_number=100,
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=commit_comparison,
            app_name="My App",
            build_version="1.0",
            build_number=1,
        )
        analysis_file = self._create_analysis_file(self._make_analysis_data())
        head_main_metric = self.create_preprod_artifact_size_metrics(
            head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_download_size=16000000,
            max_install_size=18000000,
            analysis_file_id=analysis_file.id,
        )
        head_watch_metric = self.create_preprod_artifact_size_metrics(
            head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_download_size=8000000,
            max_install_size=9000000,
        )

        # Base artifact
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha=commit_comparison.base_sha,
            base_sha="0000000000000000000000000000000000000000",
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
            app_name="My App",
            build_version="0.9",
            build_number=0,
        )
        base_main_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_download_size=15000000,
            max_install_size=17000000,
        )
        base_watch_metric = self.create_preprod_artifact_size_metrics(
            base_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_download_size=7000000,
            max_install_size=8000000,
        )

        # Main comparison
        main_comp_data = self._make_comparison_data(
            head_sizes=(16000000, 18000000),
            base_sizes=(15000000, 17000000),
        )
        main_comp_file = self._create_analysis_file(main_comp_data)
        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=head_main_metric,
            base_size_analysis=base_main_metric,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=main_comp_file.id,
        )

        # Watch comparison
        watch_comp_data = self._make_comparison_data(
            head_sizes=(8000000, 9000000),
            base_sizes=(7000000, 8000000),
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="com.example.watch",
        )
        watch_comp_file = self._create_analysis_file(watch_comp_data)
        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=head_watch_metric,
            base_size_analysis=base_watch_metric,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=watch_comp_file.id,
        )

        payload = build_webhook_payload(head_artifact)

        assert payload is not None
        assert payload["state"] == "COMPLETED"
        assert payload["baseBuildId"] == str(base_artifact.id)
        assert payload["comparisons"] is not None
        assert len(payload["comparisons"]) == 2

        comparisons_by_type = {c["metricsArtifactType"]: c for c in payload["comparisons"]}
        assert "MAIN_ARTIFACT" in comparisons_by_type
        assert "WATCH_ARTIFACT" in comparisons_by_type

        main_comp = comparisons_by_type["MAIN_ARTIFACT"]
        assert main_comp["state"] == "SUCCESS"
        assert main_comp["sizeMetricDiff"] is not None
        assert "diffItems" not in main_comp
        assert "insightDiffItems" not in main_comp

        watch_comp = comparisons_by_type["WATCH_ARTIFACT"]
        assert watch_comp["state"] == "SUCCESS"
        assert watch_comp["identifier"] == "com.example.watch"
        assert watch_comp["sizeMetricDiff"] is not None
        assert "diffItems" not in watch_comp
        assert "insightDiffItems" not in watch_comp

    # ------------------------------------------------------------------
    # Analysis failures
    # ------------------------------------------------------------------

    def test_analysis_failed(self):
        """Analysis failure produces FAILED payload with error details."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_ref="feature/broken-build",
            base_ref="main",
            head_repo_name="acme/my-ios-app",
            pr_number=1050,
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=commit_comparison,
        )
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR,
            error_message="Failed to extract size metrics from artifact",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "FAILED"
        assert payload["errorCode"] == "PROCESSING_ERROR"
        assert payload["errorMessage"] == "Failed to extract size metrics from artifact"
        assert payload["downloadSize"] is None
        assert payload["installSize"] is None
        assert payload["comparisons"] is None

        self._assert_no_api_heavy_fields(payload)

    def test_analysis_timeout_error_code(self):
        """Timeout error code is mapped correctly."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.TIMEOUT,
            error_message="Size analysis timed out",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["errorCode"] == "TIMEOUT"

    def test_unsupported_artifact_error_code(self):
        """Unsupported artifact error code is mapped correctly."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.UNSUPPORTED_ARTIFACT,
            error_message="Unsupported artifact type",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["errorCode"] == "UNSUPPORTED_ARTIFACT"

    # ------------------------------------------------------------------
    # Suppressed states
    # ------------------------------------------------------------------

    def test_not_ran_returns_none(self):
        """NOT_RAN state should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.NO_QUOTA,
            error_message="No quota available",
        )

        assert build_webhook_payload(artifact) is None

    def test_pending_returns_none(self):
        """PENDING state should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        assert build_webhook_payload(artifact) is None

    def test_processing_returns_none(self):
        """PROCESSING state should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )

        assert build_webhook_payload(artifact) is None

    def test_no_metrics_returns_none(self):
        """No size metrics at all should not produce a webhook payload."""
        artifact = self.create_preprod_artifact(project=self.project)

        assert build_webhook_payload(artifact) is None

    # ------------------------------------------------------------------
    # Edge cases
    # ------------------------------------------------------------------

    def test_no_mobile_app_info(self):
        """Artifact without mobile app info has null appInfo fields."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            create_mobile_app_info=False,
        )
        analysis_file = self._create_analysis_file(self._make_analysis_data())
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=analysis_file.id,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["appInfo"]["name"] is None
        assert payload["appInfo"]["version"] is None
        assert payload["appInfo"]["buildNumber"] is None

    def test_build_id_is_string(self):
        """buildId should always be a string, not an integer."""
        artifact, _ = self._create_artifact_with_completed_analysis()

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert isinstance(payload["buildId"], str)

    def test_android_apk_artifact_type(self):
        """Android APK artifact has correct appInfo.artifactType."""
        artifact, _ = self._create_artifact_with_completed_analysis(
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["appInfo"]["artifactType"] == "APK"

    def test_android_aab_artifact_type(self):
        """Android AAB artifact has correct appInfo.artifactType."""
        artifact, _ = self._create_artifact_with_completed_analysis(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["appInfo"]["artifactType"] == "AAB"


class SendSizeAnalysisWebhookTest(TestCase):
    """Tests for the send_size_analysis_webhook function."""

    def _create_analysis_file(self, data):
        f = self.create_file(name="analysis.json", type="application/json")
        f.putfile(BytesIO(json.dumps(data).encode()))
        return f

    def _create_artifact_with_completed_analysis(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_name="My App",
            build_version="1.0.0",
            build_number=1,
        )
        analysis_data = {
            "analysis_duration": 1.5,
            "download_size": 1048576,
            "install_size": 2097152,
            "analysis_version": "1.0.0",
            "treemap": None,
            "insights": None,
            "file_analysis": None,
            "app_components": None,
        }
        analysis_file = self._create_analysis_file(analysis_data)
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=analysis_file.id,
        )
        return artifact

    @patch("sentry.preprod.size_analysis.webhooks.broadcast_webhooks_for_organization")
    def test_sends_webhook(self, mock_broadcast):
        """Webhook is sent for a completed build with API-subset payload."""
        artifact = self._create_artifact_with_completed_analysis()

        send_size_analysis_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_called_once()
        call_kwargs = mock_broadcast.delay.call_args
        assert call_kwargs.kwargs["resource_name"] == "preprod_artifact"
        assert call_kwargs.kwargs["event_name"] == "size_analysis_completed"
        assert call_kwargs.kwargs["organization_id"] == self.organization.id
        assert call_kwargs.kwargs["payload"]["buildId"] == str(artifact.id)
        assert call_kwargs.kwargs["payload"]["organizationSlug"] == self.organization.slug
        assert call_kwargs.kwargs["payload"]["projectSlug"] == self.project.slug
        assert call_kwargs.kwargs["payload"]["state"] == "COMPLETED"

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
    def test_does_not_send_for_no_metrics(self, mock_broadcast):
        """Webhook is NOT sent when no size metrics exist."""
        artifact = self.create_preprod_artifact(project=self.project)

        send_size_analysis_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_not_called()

    @patch("sentry.preprod.size_analysis.webhooks.broadcast_webhooks_for_organization")
    def test_broadcast_exception_is_caught(self, mock_broadcast):
        """Exceptions from broadcast are caught and logged, not re-raised."""
        artifact = self._create_artifact_with_completed_analysis()
        mock_broadcast.delay.side_effect = Exception("Celery task failed")

        # Should not raise
        send_size_analysis_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_called_once()
