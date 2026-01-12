from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import Mock, patch

import responses
from django.utils import timezone

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.vcs.status_checks.size.tasks import (
    StatusCheckErrorType,
    create_preprod_status_check_task,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class CreatePreprodStatusCheckTaskTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )
        self.project.update_option("sentry:preprod_size_status_checks_enabled", True)

    def _create_preprod_artifact(
        self,
        state=PreprodArtifact.ArtifactState.PROCESSED,
        with_commit_comparison=True,
        error_message=None,
        app_id="com.example.app",
        unique_shas=True,
    ):
        """Helper to create PreprodArtifact with optional CommitComparison."""
        preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=state,
            error_message=error_message,
            app_id=app_id,
        )

        if with_commit_comparison:
            # Generate unique SHAs if requested to avoid constraint violations
            if unique_shas:
                unique_suffix = str(uuid.uuid4()).replace("-", "")[:8]
                head_sha = unique_suffix.ljust(40, "a")  # Pad with 'a' to make 40 chars
                base_sha = unique_suffix.ljust(40, "b")  # Pad with 'b' to make 40 chars
            else:
                head_sha = "a" * 40
                base_sha = "b" * 40

            commit_comparison = CommitComparison.objects.create(
                organization_id=self.organization.id,
                head_sha=head_sha,
                base_sha=base_sha,
                provider="github",
                head_repo_name="owner/repo",
                base_repo_name="owner/repo",
                head_ref="feature/test",
                base_ref="main",
            )
            preprod_artifact.commit_comparison = commit_comparison
            preprod_artifact.save()

        return preprod_artifact

    def _create_working_status_check_setup(self, preprod_artifact):
        """Helper to mock a working status check setup with GitHub integration."""
        # Create repository that matches the commit comparison
        repository = Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
        )

        # Mock the status check client and provider chain
        mock_client = Mock()
        mock_provider = Mock()
        mock_provider.create_status_check.return_value = "check_12345"

        patcher_client = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_client",
            return_value=(mock_client, repository),
        )
        patcher_provider = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_provider",
            return_value=mock_provider,
        )

        return mock_client, mock_provider, patcher_client, patcher_provider

    def _create_no_api_calls_setup(self):
        """Helper to mock setup for tests that expect no API calls to be made."""
        mock_client = Mock()
        mock_provider = Mock()

        patcher_client = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_client",
            return_value=(mock_client, None),
        )
        patcher_provider = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_provider",
            return_value=mock_provider,
        )

        return mock_client, mock_provider, patcher_client, patcher_provider

    def test_create_preprod_status_check_task_nonexistent_artifact(self):
        """Test task handles nonexistent PreprodArtifact gracefully and makes no API calls."""
        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(99999)  # Nonexistent ID

            # Verify no API calls were made since artifact doesn't exist
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_no_commit_comparison(self):
        """Test task returns early when PreprodArtifact has no CommitComparison and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact(with_commit_comparison=False)
        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made since there's no commit comparison
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_missing_git_info(self):
        """Test task handles missing git info in CommitComparison and makes no API calls."""
        preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
        )

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="",  # Empty string instead of None to avoid constraint violation
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )
        preprod_artifact.commit_comparison = commit_comparison
        preprod_artifact.save()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing git info
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_missing_head_repo_name(self):
        """Test task handles missing head_repo_name in CommitComparison and makes no API calls."""
        preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
        )

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="",  # Empty string instead of None to avoid constraint violation
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )
        preprod_artifact.commit_comparison = commit_comparison
        preprod_artifact.save()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing head_repo_name
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_no_repository_integration(self):
        """Test task handles missing repository integration gracefully and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing repository integration
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_repository_no_integration_id(self):
        """Test task handles repository with no integration_id and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact()

        # Create repository without integration
        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=None,
        )

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing integration_id
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_unsupported_provider(self):
        """Test task handles unsupported VCS provider gracefully and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact()
        # Change provider to unsupported one (GitLab is not supported)
        preprod_artifact.commit_comparison.provider = "gitlab"
        preprod_artifact.commit_comparison.save()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to unsupported provider
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_all_artifact_states(self):
        """Test task handles all valid artifact states and creates correct status checks."""
        test_cases = [
            (PreprodArtifact.ArtifactState.UPLOADING, StatusCheckStatus.IN_PROGRESS, None),
            (PreprodArtifact.ArtifactState.UPLOADED, StatusCheckStatus.IN_PROGRESS, None),
            (PreprodArtifact.ArtifactState.PROCESSED, StatusCheckStatus.SUCCESS, None),
            (PreprodArtifact.ArtifactState.FAILED, StatusCheckStatus.FAILURE, "Test error message"),
        ]

        for artifact_state, expected_status, error_message in test_cases:
            with self.subTest(state=artifact_state):
                preprod_artifact = self._create_preprod_artifact(
                    state=artifact_state,
                    error_message=error_message,
                    app_id=f"com.test.{artifact_state.name.lower()}",
                )

                if artifact_state == PreprodArtifact.ArtifactState.PROCESSED:
                    PreprodArtifactSizeMetrics.objects.create(
                        preprod_artifact=preprod_artifact,
                        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                        min_download_size=1024 * 1024,
                        max_download_size=1024 * 1024,
                        min_install_size=2 * 1024 * 1024,
                        max_install_size=2 * 1024 * 1024,
                    )

                _, mock_provider, client_patch, provider_patch = (
                    self._create_working_status_check_setup(preprod_artifact)
                )

                with client_patch, provider_patch:
                    with self.tasks():
                        create_preprod_status_check_task(preprod_artifact.id)

                mock_provider.create_status_check.assert_called_once()
                call_kwargs = mock_provider.create_status_check.call_args.kwargs

                assert call_kwargs["repo"] == "owner/repo"
                assert call_kwargs["sha"] == preprod_artifact.commit_comparison.head_sha
                assert call_kwargs["status"] == expected_status
                assert call_kwargs["title"] == "Size Analysis"

                if expected_status == StatusCheckStatus.SUCCESS:
                    # SUCCESS only when processed AND has completed size metrics
                    assert "1 app" in call_kwargs["subtitle"]
                elif expected_status == StatusCheckStatus.IN_PROGRESS:
                    assert "1 app processing" in call_kwargs["subtitle"]
                elif expected_status == StatusCheckStatus.FAILURE:
                    assert "1 app errored" in call_kwargs["subtitle"]

                assert call_kwargs["summary"]  # Just check it exists
                assert call_kwargs["external_id"] == str(preprod_artifact.id)

    def test_create_preprod_status_check_task_api_failure_handling(self):
        """Test task handles status check API failures gracefully."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            preprod_artifact
        )

        # TODO(telkins): come up with a better error case
        mock_provider.create_status_check.return_value = None  # Simulate API failure

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

        # Verify API was called but task completed without exception
        mock_provider.create_status_check.assert_called_once()

    def test_create_preprod_status_check_task_multiple_artifacts_same_commit(self):
        """Test task handles multiple artifacts for the same commit (monorepo scenario)."""
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create multiple artifacts for the same commit (monorepo scenario)
        artifacts = []
        for i in range(3):
            artifact = PreprodArtifact.objects.create(
                project=self.project,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                app_id=f"com.example.app{i}",
                build_version="1.0.0",
                build_number=i + 1,
                commit_comparison=commit_comparison,
            )
            PreprodArtifactSizeMetrics.objects.create(
                preprod_artifact=artifact,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                min_download_size=1024 * 1024,
                max_download_size=1024 * 1024,
                min_install_size=2 * 1024 * 1024,
                max_install_size=2 * 1024 * 1024,
            )
            artifacts.append(artifact)

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            artifacts[0]
        )

        with client_patch, provider_patch:
            with self.tasks():
                # Call with just one artifact ID - it should find all sibling artifacts
                create_preprod_status_check_task(artifacts[0].id)

        mock_provider.create_status_check.assert_called_once()
        call_kwargs = mock_provider.create_status_check.call_args.kwargs

        assert call_kwargs["title"] == "Size Analysis"
        assert call_kwargs["subtitle"] == "3 apps analyzed"  # All processed with completed metrics

        summary = call_kwargs["summary"]
        assert "com.example.app0" in summary
        assert "com.example.app1" in summary
        assert "com.example.app2" in summary

    def test_create_preprod_status_check_task_mixed_states_monorepo(self):
        """Test task handles mixed artifact states in monorepo scenario."""
        from sentry.preprod.models import PreprodArtifactSizeMetrics

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        processed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.processed",
            commit_comparison=commit_comparison,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=processed_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        _ = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADING,
            app_id="com.example.uploading",
            commit_comparison=commit_comparison,
        )

        _ = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.FAILED,
            app_id="com.example.failed",
            error_message="Upload timeout",
            commit_comparison=commit_comparison,
        )

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            processed_artifact
        )

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(processed_artifact.id)

        mock_provider.create_status_check.assert_called_once()
        call_kwargs = mock_provider.create_status_check.call_args.kwargs

        assert call_kwargs["title"] == "Size Analysis"
        assert call_kwargs["subtitle"] == "1 app analyzed, 1 app processing, 1 app errored"
        assert call_kwargs["status"] == StatusCheckStatus.FAILURE  # Failed takes priority

        summary = call_kwargs["summary"]
        assert "com.example.processed" in summary
        assert "com.example.uploading" in summary
        assert "com.example.failed" in summary
        assert "Upload timeout" in summary

    @responses.activate
    def test_create_preprod_status_check_task_github_permission_error(self):
        """Test task handles GitHub permission errors without retrying."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        integration = self.create_integration(
            organization=self.organization,
            external_id="123",
            provider="github",
            metadata={"access_token": "test_token", "expires_at": "2099-01-01T00:00:00Z"},
        )

        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/owner/repo/check-runs",
            status=403,
            json={
                "message": "Resource not accessible by integration",
                "documentation_url": "https://docs.github.com/rest/checks/runs#create-a-check-run",
            },
        )

        with self.tasks():
            try:
                create_preprod_status_check_task(preprod_artifact.id)
                assert False, "Expected IntegrationConfigurationError to be raised"
            except IntegrationConfigurationError as e:
                assert "GitHub App lacks permissions" in str(e)
                assert "required permissions" in str(e)

        # Verify no retries due to ignore policy
        assert len(responses.calls) == 1
        assert (
            responses.calls[0].request.url == "https://api.github.com/repos/owner/repo/check-runs"
        )

    @responses.activate
    def test_create_preprod_status_check_task_github_non_permission_403(self):
        """Test task re-raises non-permission 403 errors (allows retry for transient issues)."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        integration = self.create_integration(
            organization=self.organization,
            external_id="456",
            provider="github",
            metadata={"access_token": "test_token", "expires_at": "2099-01-01T00:00:00Z"},
        )

        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        # 403 error that's NOT permission-related (should re-raise to allow retry)
        responses.add(
            responses.POST,
            "https://api.github.com/repos/owner/repo/check-runs",
            status=403,
            json={
                "message": "Repository is temporarily unavailable",
            },
        )

        with self.tasks():
            # Should re-raise ApiForbiddenError (not convert to IntegrationConfigurationError)
            # This allows the task system to retry in case it's a transient issue
            try:
                create_preprod_status_check_task(preprod_artifact.id)
                assert False, "Expected ApiForbiddenError to be raised"
            except Exception as e:
                assert e.__class__.__name__ == "ApiForbiddenError"
                assert "temporarily unavailable" in str(e)

        assert len(responses.calls) == 1
        assert (
            responses.calls[0].request.url == "https://api.github.com/repos/owner/repo/check-runs"
        )

    @responses.activate
    def test_create_preprod_status_check_task_github_400_error(self):
        """Test task converts 400 errors to IntegrationConfigurationError (no retry)."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        integration = self.create_integration(
            organization=self.organization,
            external_id="789",
            provider="github",
            metadata={"access_token": "test_token", "expires_at": "2099-01-01T00:00:00Z"},
        )

        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/owner/repo/check-runs",
            status=400,
            json={
                "message": "Invalid request",
                "errors": [{"field": "head_sha", "code": "invalid"}],
            },
        )

        with self.tasks():
            try:
                create_preprod_status_check_task(preprod_artifact.id)
                assert False, "Expected IntegrationConfigurationError to be raised"
            except IntegrationConfigurationError as e:
                assert "400 client error" in str(e)

        # Verify no retries
        assert len(responses.calls) == 1

    @responses.activate
    def test_create_preprod_status_check_task_github_429_error(self):
        """Test task allows 429 rate limit errors to retry"""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        integration = self.create_integration(
            organization=self.organization,
            external_id="999",
            provider="github",
            metadata={"access_token": "test_token", "expires_at": "2099-01-01T00:00:00Z"},
        )

        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/owner/repo/check-runs",
            status=429,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        with self.tasks():
            # 429 should be re-raised as ApiRateLimitedError (not converted to IntegrationConfigurationError)
            # This allows the task system to retry with backoff
            try:
                create_preprod_status_check_task(preprod_artifact.id)
                assert False, "Expected ApiRateLimitedError to be raised"
            except Exception as e:
                assert e.__class__.__name__ == "ApiRateLimitedError"
                assert "rate limit" in str(e).lower()

        assert len(responses.calls) == 1

    @responses.activate
    def test_create_preprod_status_check_task_truncates_long_summary(self):
        """Test task truncates summary when it exceeds GitHub's byte limit."""
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        artifacts = []
        for i in range(150):
            long_app_id = f"com.example.very.long.app.identifier.number.{i}" + "x" * 200
            artifact = PreprodArtifact.objects.create(
                project=self.project,
                state=PreprodArtifact.ArtifactState.FAILED,
                app_id=long_app_id,
                error_message=f"This is a very long error message that will contribute to the summary size. Error #{i}: "
                + "y" * 500,
                commit_comparison=commit_comparison,
            )
            artifacts.append(artifact)

        integration = self.create_integration(
            organization=self.organization,
            external_id="test-truncation",
            provider="github",
            metadata={"access_token": "test_token", "expires_at": "2099-01-01T00:00:00Z"},
        )

        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/owner/repo/check-runs",
            status=201,
            json={"id": 12345, "status": "completed"},
        )

        with self.tasks():
            create_preprod_status_check_task(artifacts[0].id)

        assert len(responses.calls) == 1
        request_body = responses.calls[0].request.body

        payload = json.loads(request_body)
        summary = payload["output"]["summary"]

        assert summary is not None
        summary_bytes = len(summary.encode("utf-8"))

        assert summary_bytes <= 65535, f"Summary has {summary_bytes} bytes, exceeds GitHub limit"
        assert summary.endswith("..."), "Truncated summary should end with '...'"

    def test_sibling_deduplication_after_reprocessing(self):
        """Test that get_sibling_artifacts_for_commit() deduplicates by (app_id, artifact_type).

        When artifacts are reprocessed (e.g., CI retry), new artifacts are created
        with the same (app_id, artifact_type). This test verifies that the sibling lookup
        returns only one artifact per (app_id, artifact_type) to prevent duplicate rows
        in status checks.
        """
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/reprocess-test",
            base_ref="main",
        )

        ios_old = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.ios",
            app_name="iOS App Old",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=ios_old,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        android_old = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_id="com.example.android",
            app_name="Android App Old",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=android_old,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        later_time = timezone.now() + timedelta(hours=1)

        ios_new = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.ios",
            app_name="iOS App New",
            build_version="1.0.0",
            build_number=2,
            commit_comparison=commit_comparison,
        )
        ios_new.date_added = later_time
        ios_new.save(update_fields=["date_added"])
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=ios_new,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        android_new = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_id="com.example.android",
            app_name="Android App New",
            build_version="1.0.0",
            build_number=2,
            commit_comparison=commit_comparison,
        )
        android_new.date_added = later_time
        android_new.save(update_fields=["date_added"])
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=android_new,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        siblings_from_ios_new = list(ios_new.get_sibling_artifacts_for_commit())
        assert len(siblings_from_ios_new) == 2, (
            f"Expected 2 siblings (one per app_id), got {len(siblings_from_ios_new)}. "
            f"Deduplication by app_id should prevent showing all 4 artifacts."
        )

        sibling_ids_from_ios_new = {s.id for s in siblings_from_ios_new}
        assert (
            ios_new.id in sibling_ids_from_ios_new
        ), "Triggering artifact (ios_new) should be included in its own app_id group"
        assert (
            android_old.id in sibling_ids_from_ios_new
        ), "For other app_ids, should use earliest artifact (android_old, not android_new)"

        siblings_from_android_new = list(android_new.get_sibling_artifacts_for_commit())
        assert len(siblings_from_android_new) == 2

        sibling_ids_from_android_new = {s.id for s in siblings_from_android_new}
        assert (
            android_new.id in sibling_ids_from_android_new
        ), "Triggering artifact (android_new) should be included in its own app_id group"
        assert (
            ios_old.id in sibling_ids_from_android_new
        ), "For other app_ids, should use earliest artifact (ios_old, not ios_new)"

        siblings_from_ios_old = list(ios_old.get_sibling_artifacts_for_commit())
        assert len(siblings_from_ios_old) == 2
        sibling_ids_from_ios_old = {s.id for s in siblings_from_ios_old}
        assert ios_old.id in sibling_ids_from_ios_old
        assert android_old.id in sibling_ids_from_ios_old

    def test_sibling_deduplication_with_same_app_id_different_platforms(self):
        """Test that iOS and Android builds with the same app_id are not deduplicated.

        Users can upload both Android and iOS builds with the same app_id (e.g., "com.example.app").
        This test verifies that the sibling lookup returns both platform artifacts even if they
        share the same app_id, because deduplication is by (app_id, artifact_type).
        """
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="c" * 40,
            base_sha="d" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/cross-platform",
            base_ref="main",
        )

        same_app_id = "com.example.multiplatform"

        ios_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id=same_app_id,
            app_name="Multiplatform App (iOS)",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=ios_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        android_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_id=same_app_id,
            app_name="Multiplatform App (Android)",
            build_version="1.0.0",
            build_number=1,
            commit_comparison=commit_comparison,
        )
        android_artifact.date_added = timezone.now() + timedelta(seconds=1)
        android_artifact.save(update_fields=["date_added"])
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=android_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        siblings_from_ios = list(ios_artifact.get_sibling_artifacts_for_commit())
        assert len(siblings_from_ios) == 2, (
            f"Expected 2 siblings (iOS + Android with same app_id), got {len(siblings_from_ios)}. "
            f"Both platforms should be included even with the same app_id."
        )

        sibling_ids_from_ios = {s.id for s in siblings_from_ios}
        assert (
            ios_artifact.id in sibling_ids_from_ios
        ), "iOS artifact should be included in siblings"
        assert (
            android_artifact.id in sibling_ids_from_ios
        ), "Android artifact should be included even with same app_id (different platform)"

        siblings_from_android = list(android_artifact.get_sibling_artifacts_for_commit())
        assert len(siblings_from_android) == 2

        sibling_ids_from_android = {s.id for s in siblings_from_android}
        assert android_artifact.id in sibling_ids_from_android
        assert ios_artifact.id in sibling_ids_from_android

        later_time = timezone.now() + timedelta(hours=1)
        ios_artifact_new = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id=same_app_id,
            app_name="Multiplatform App (iOS v2)",
            build_version="1.0.0",
            build_number=2,
            commit_comparison=commit_comparison,
        )
        ios_artifact_new.date_added = later_time
        ios_artifact_new.save(update_fields=["date_added"])
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=ios_artifact_new,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        siblings_from_ios_new = list(ios_artifact_new.get_sibling_artifacts_for_commit())
        assert len(siblings_from_ios_new) == 2, (
            f"Expected 2 siblings after iOS reprocessing, got {len(siblings_from_ios_new)}. "
            f"Should show 1 iOS (newest) + 1 Android (only one)."
        )

        sibling_ids_from_ios_new = {s.id for s in siblings_from_ios_new}
        assert (
            ios_artifact_new.id in sibling_ids_from_ios_new
        ), "New iOS artifact should be included (triggering artifact)"
        assert (
            android_artifact.id in sibling_ids_from_ios_new
        ), "Original Android should still be included"
        assert (
            ios_artifact.id not in sibling_ids_from_ios_new
        ), "Old iOS artifact should be deduplicated (not the triggering artifact)"

    def test_posted_status_check_success(self):
        """Test that successful status check posts are recorded in artifact extras."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            preprod_artifact
        )
        mock_provider.create_status_check.return_value = "check_12345"

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

        preprod_artifact.refresh_from_db()
        assert preprod_artifact.extras is not None
        assert "posted_status_checks" in preprod_artifact.extras
        assert "size" in preprod_artifact.extras["posted_status_checks"]
        assert preprod_artifact.extras["posted_status_checks"]["size"]["success"] is True
        assert preprod_artifact.extras["posted_status_checks"]["size"]["check_id"] == "check_12345"

    def test_posted_status_check_failure_null_check_id(self):
        """Test that failed status check posts (null check_id) are recorded in artifact extras."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            preprod_artifact
        )
        mock_provider.create_status_check.return_value = None  # Simulate API returning no check_id

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

        preprod_artifact.refresh_from_db()
        assert preprod_artifact.extras is not None
        assert "posted_status_checks" in preprod_artifact.extras
        assert "size" in preprod_artifact.extras["posted_status_checks"]
        assert preprod_artifact.extras["posted_status_checks"]["size"]["success"] is False
        assert (
            preprod_artifact.extras["posted_status_checks"]["size"]["error_type"]
            == StatusCheckErrorType.UNKNOWN.value
        )

    @responses.activate
    def test_posted_status_check_failure_integration_error(self):
        """Test that integration errors during status check creation are recorded in artifact extras."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        integration = self.create_integration(
            organization=self.organization,
            external_id="test-integration-error",
            provider="github",
            metadata={"access_token": "test_token", "expires_at": "2099-01-01T00:00:00Z"},
        )

        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/owner/repo/check-runs",
            status=403,
            json={
                "message": "Resource not accessible by integration",
                "documentation_url": "https://docs.github.com/rest/checks/runs#create-a-check-run",
            },
        )

        with self.tasks():
            try:
                create_preprod_status_check_task(preprod_artifact.id)
            except IntegrationConfigurationError:
                pass  # Expected

        preprod_artifact.refresh_from_db()
        assert preprod_artifact.extras is not None
        assert "posted_status_checks" in preprod_artifact.extras
        assert "size" in preprod_artifact.extras["posted_status_checks"]
        assert preprod_artifact.extras["posted_status_checks"]["size"]["success"] is False
        assert (
            preprod_artifact.extras["posted_status_checks"]["size"]["error_type"]
            == StatusCheckErrorType.INTEGRATION_ERROR.value
        )

    def test_posted_status_check_preserves_existing_extras(self):
        """Test that recording status check result preserves other fields in extras."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )
        preprod_artifact.extras = {"existing_field": "existing_value", "another_field": 123}
        preprod_artifact.save()

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            preprod_artifact
        )
        mock_provider.create_status_check.return_value = "check_67890"

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

        preprod_artifact.refresh_from_db()
        assert preprod_artifact.extras is not None
        # Verify existing fields are preserved
        assert preprod_artifact.extras["existing_field"] == "existing_value"
        assert preprod_artifact.extras["another_field"] == 123
        # Verify new field is added
        assert "posted_status_checks" in preprod_artifact.extras
        assert "size" in preprod_artifact.extras["posted_status_checks"]
        assert preprod_artifact.extras["posted_status_checks"]["size"]["success"] is True
        assert preprod_artifact.extras["posted_status_checks"]["size"]["check_id"] == "check_67890"
