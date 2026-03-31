from unittest.mock import patch

from sentry.preprod.build_distribution_webhooks import (
    build_webhook_payload,
    send_build_distribution_webhook,
)
from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import TestCase


class BuildWebhookPayloadTest(TestCase):
    """Tests for the build_webhook_payload function.

    The webhook payload must be a strict subset of the public install-info API
    response, excluding ``downloadCount``, ``releaseNotes``, and
    ``installGroups``.
    """

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _create_installable_artifact(
        self,
        commit_comparison=None,
        artifact_type=PreprodArtifact.ArtifactType.AAB,
        app_name="Example App",
        build_version="1.0.0",
        build_number=1,
        app_id="com.example.app",
        installable_app_file_id=12345,
    ):
        """Create an artifact with installable_app_file_id set (success terminal)."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=artifact_type,
            commit_comparison=commit_comparison,
            app_name=app_name,
            build_version=build_version,
            build_number=build_number,
            app_id=app_id,
        )
        artifact.installable_app_file_id = installable_app_file_id
        artifact.save(update_fields=["installable_app_file_id"])
        return artifact

    def _create_failed_artifact(
        self,
        error_code=PreprodArtifact.InstallableAppErrorCode.PROCESSING_ERROR,
        error_message="Unsupported artifact type",
        commit_comparison=None,
        artifact_type=PreprodArtifact.ArtifactType.AAB,
        app_name="Example App",
        build_version="1.0.0",
        build_number=1,
        app_id="com.example.app",
    ):
        """Create an artifact with installable_app_error_code set (failure terminal)."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=artifact_type,
            commit_comparison=commit_comparison,
            app_name=app_name,
            build_version=build_version,
            build_number=build_number,
            app_id=app_id,
        )
        artifact.installable_app_error_code = error_code
        artifact.installable_app_error_message = error_message
        artifact.save(update_fields=["installable_app_error_code", "installable_app_error_message"])
        return artifact

    def _assert_no_transient_fields(self, payload):
        """Assert that transient/mutable fields are absent."""
        for field in ("downloadCount", "releaseNotes", "installGroups"):
            assert field not in payload, f"Transient field '{field}' should not be present"

    # ------------------------------------------------------------------
    # Completed (success) builds
    # ------------------------------------------------------------------

    def test_completed_android_build(self) -> None:
        """Completed Android build produces correct payload."""
        artifact = self._create_installable_artifact()

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["buildId"] == str(artifact.id)
        assert payload["organizationSlug"] == self.organization.slug
        assert payload["projectId"] == str(self.project.id)
        assert payload["projectSlug"] == self.project.slug
        assert payload["platform"] == "ANDROID"
        assert payload["state"] == "COMPLETED"
        assert payload["errorCode"] is None
        assert payload["errorMessage"] is None

        # appInfo matches canonical shape
        assert payload["appInfo"]["name"] == "Example App"
        assert payload["appInfo"]["version"] == "1.0.0"
        assert payload["appInfo"]["buildNumber"] == 1
        assert payload["appInfo"]["artifactType"] == "AAB"
        assert payload["appInfo"]["appId"] == "com.example.app"
        assert payload["appInfo"]["dateAdded"] is not None

        # Distribution-specific fields
        assert payload["buildConfiguration"] is None
        assert payload["isCodeSignatureValid"] is None
        assert payload["profileName"] is None
        assert payload["codesigningType"] is None

        # No git context
        assert payload["gitInfo"] is None

        self._assert_no_transient_fields(payload)

    def test_completed_apple_build(self) -> None:
        """Completed Apple build includes code-signing fields."""
        artifact = self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["platform"] == "APPLE"
        assert payload["state"] == "COMPLETED"
        assert payload["appInfo"]["artifactType"] == "XCARCHIVE"
        # Code-signing fields present (values depend on extras, defaulting to False/None)
        assert "isCodeSignatureValid" in payload
        assert "profileName" in payload
        assert "codesigningType" in payload

    def test_completed_build_with_git_context(self) -> None:
        """Completed build with commit comparison has gitInfo."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="abc123def456",
            base_sha="789xyz000111",
            head_ref="feature-branch",
            base_ref="main",
            head_repo_name="org/repo",
            pr_number=42,
        )
        artifact = self._create_installable_artifact(commit_comparison=commit_comparison)

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "COMPLETED"
        assert payload["gitInfo"] is not None
        assert payload["gitInfo"]["headSha"] == "abc123def456"
        assert payload["gitInfo"]["baseSha"] == "789xyz000111"
        assert payload["gitInfo"]["headRef"] == "feature-branch"
        assert payload["gitInfo"]["baseRef"] == "main"
        assert payload["gitInfo"]["headRepoName"] == "org/repo"
        assert payload["gitInfo"]["prNumber"] == 42

    def test_completed_but_not_installable(self) -> None:
        """Completed build that is not installable (e.g. missing build number)."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            create_mobile_app_info=False,
        )
        artifact.installable_app_file_id = 12345
        artifact.save(update_fields=["installable_app_file_id"])

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "COMPLETED"
        assert payload["isInstallable"] is False
        assert payload["installUrl"] is None

    # ------------------------------------------------------------------
    # Failed builds
    # ------------------------------------------------------------------

    def test_failed_build(self) -> None:
        """Failed build produces FAILED payload with error details."""
        artifact = self._create_failed_artifact(
            error_code=PreprodArtifact.InstallableAppErrorCode.PROCESSING_ERROR,
            error_message="Unsupported artifact type",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "FAILED"
        assert payload["errorCode"] == "PROCESSING_ERROR"
        assert payload["errorMessage"] == "Unsupported artifact type"
        assert payload["isInstallable"] is False
        assert payload["installUrl"] is None

        self._assert_no_transient_fields(payload)

    def test_failed_no_quota(self) -> None:
        """NO_QUOTA error code is mapped correctly."""
        artifact = self._create_failed_artifact(
            error_code=PreprodArtifact.InstallableAppErrorCode.NO_QUOTA,
            error_message="No quota available for distribution",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "FAILED"
        assert payload["errorCode"] == "NO_QUOTA"

    def test_failed_skipped(self) -> None:
        """SKIPPED error code is mapped correctly."""
        artifact = self._create_failed_artifact(
            error_code=PreprodArtifact.InstallableAppErrorCode.SKIPPED,
            error_message="Distribution was not requested",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "FAILED"
        assert payload["errorCode"] == "SKIPPED"

    def test_failed_unknown(self) -> None:
        """UNKNOWN error code is mapped correctly."""
        artifact = self._create_failed_artifact(
            error_code=PreprodArtifact.InstallableAppErrorCode.UNKNOWN,
            error_message="Unknown error",
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "FAILED"
        assert payload["errorCode"] == "UNKNOWN"

    # ------------------------------------------------------------------
    # Suppressed states
    # ------------------------------------------------------------------

    def test_non_terminal_returns_none(self) -> None:
        """Artifact with neither file nor error returns None."""
        artifact = self.create_preprod_artifact(project=self.project)

        assert build_webhook_payload(artifact) is None

    def test_deleted_artifact_returns_none(self) -> None:
        """Deleted artifact returns None."""
        artifact = self._create_installable_artifact()
        artifact_id = artifact.id
        artifact.delete()

        # Create a dummy object with the old id to pass to the function
        dummy = PreprodArtifact(id=artifact_id)
        assert build_webhook_payload(dummy) is None

    # ------------------------------------------------------------------
    # Edge cases
    # ------------------------------------------------------------------

    def test_build_id_is_string(self) -> None:
        """buildId should always be a string, not an integer."""
        artifact = self._create_installable_artifact()

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert isinstance(payload["buildId"], str)

    def test_project_id_is_string(self) -> None:
        """projectId should always be a string, not an integer."""
        artifact = self._create_installable_artifact()

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert isinstance(payload["projectId"], str)

    def test_no_mobile_app_info(self) -> None:
        """Artifact without mobile app info has null appInfo fields."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            create_mobile_app_info=False,
        )
        artifact.installable_app_file_id = 12345
        artifact.save(update_fields=["installable_app_file_id"])

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["appInfo"]["name"] is None
        assert payload["appInfo"]["version"] is None
        assert payload["appInfo"]["buildNumber"] is None

    def test_android_apk_artifact_type(self) -> None:
        """Android APK artifact has correct appInfo.artifactType."""
        artifact = self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["appInfo"]["artifactType"] == "APK"
        assert payload["platform"] == "ANDROID"

    def test_both_file_and_error_treats_as_failed(self) -> None:
        """Artifact with both file and error is treated as FAILED."""
        artifact = self._create_installable_artifact()
        artifact.installable_app_error_code = (
            PreprodArtifact.InstallableAppErrorCode.PROCESSING_ERROR
        )
        artifact.installable_app_error_message = "Error after file"
        artifact.save(update_fields=["installable_app_error_code", "installable_app_error_message"])

        payload = build_webhook_payload(artifact)

        assert payload is not None
        assert payload["state"] == "FAILED"
        assert payload["errorCode"] == "PROCESSING_ERROR"


class SendBuildDistributionWebhookTest(TestCase):
    """Tests for the send_build_distribution_webhook function."""

    def _create_installable_artifact(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_name="Example App",
            build_version="1.0.0",
            build_number=1,
        )
        artifact.installable_app_file_id = 12345
        artifact.save(update_fields=["installable_app_file_id"])
        return artifact

    @patch("sentry.preprod.build_distribution_webhooks.broadcast_webhooks_for_organization")
    def test_sends_webhook(self, mock_broadcast):
        """Webhook is sent for a completed build with correct payload."""
        artifact = self._create_installable_artifact()

        send_build_distribution_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_called_once()
        call_kwargs = mock_broadcast.delay.call_args
        assert call_kwargs.kwargs["resource_name"] == "preprod_artifact"
        assert call_kwargs.kwargs["event_name"] == "build_distribution_completed"
        assert call_kwargs.kwargs["organization_id"] == self.organization.id
        assert call_kwargs.kwargs["payload"]["buildId"] == str(artifact.id)
        assert call_kwargs.kwargs["payload"]["organizationSlug"] == self.organization.slug
        assert call_kwargs.kwargs["payload"]["projectSlug"] == self.project.slug
        assert call_kwargs.kwargs["payload"]["state"] == "COMPLETED"

    @patch("sentry.preprod.build_distribution_webhooks.broadcast_webhooks_for_organization")
    def test_does_not_send_for_non_terminal(self, mock_broadcast):
        """Webhook is NOT sent for non-terminal state."""
        artifact = self.create_preprod_artifact(project=self.project)

        send_build_distribution_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_not_called()

    @patch("sentry.preprod.build_distribution_webhooks.broadcast_webhooks_for_organization")
    def test_broadcast_exception_is_caught(self, mock_broadcast):
        """Exceptions from broadcast are caught and logged, not re-raised."""
        artifact = self._create_installable_artifact()
        mock_broadcast.delay.side_effect = Exception("Celery task failed")

        # Should not raise
        send_build_distribution_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_called_once()

    @patch("sentry.preprod.build_distribution_webhooks.broadcast_webhooks_for_organization")
    def test_sends_webhook_for_failure(self, mock_broadcast):
        """Webhook is sent for a failed build."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
        )
        artifact.installable_app_error_code = (
            PreprodArtifact.InstallableAppErrorCode.PROCESSING_ERROR
        )
        artifact.installable_app_error_message = "Failed to process"
        artifact.save(update_fields=["installable_app_error_code", "installable_app_error_message"])

        send_build_distribution_webhook(artifact=artifact, organization_id=self.organization.id)

        mock_broadcast.delay.assert_called_once()
        call_kwargs = mock_broadcast.delay.call_args
        assert call_kwargs.kwargs["payload"]["state"] == "FAILED"
        assert call_kwargs.kwargs["payload"]["errorCode"] == "PROCESSING_ERROR"
        assert call_kwargs.kwargs["payload"]["errorMessage"] == "Failed to process"
