from __future__ import annotations

import uuid
from unittest.mock import Mock, patch

import pytest

from sentry.models.commitcomparison import CommitComparison
from sentry.models.repository import Repository
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactMobileAppInfo,
    PreprodBuildConfiguration,
)
from sentry.preprod.vcs.pr_comments.tasks import create_preprod_pr_comment_task
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class CreatePreprodPrCommentTaskTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )
        self.build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )

    def _create_artifact(
        self,
        with_commit_comparison=True,
        pr_number=42,
        provider="github",
        installable_app_file_id=1,
        app_id="com.example.app",
        artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        build_number=456,
        extras=None,
        commit_comparison=None,
    ) -> PreprodArtifact:
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=artifact_type,
            app_id=app_id,
            build_configuration=self.build_config,
            installable_app_file_id=installable_app_file_id,
            extras=extras,
        )
        PreprodArtifactMobileAppInfo.objects.create(
            preprod_artifact=artifact,
            app_name="TestApp",
            build_version="1.0.0",
            build_number=build_number,
        )

        if with_commit_comparison:
            if commit_comparison is None:
                unique = str(uuid.uuid4()).replace("-", "")[:8]
                commit_comparison = CommitComparison.objects.create(
                    organization_id=self.organization.id,
                    head_sha=unique.ljust(40, "a"),
                    base_sha=unique.ljust(40, "b"),
                    provider=provider,
                    head_repo_name="owner/repo",
                    base_repo_name="owner/repo",
                    head_ref="feature/test",
                    base_ref="main",
                    pr_number=pr_number,
                )
            artifact.commit_comparison = commit_comparison
            artifact.save()

        return PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "build_configuration",
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=artifact.id)

    def _create_repo(self):
        return Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
        )

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_github_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_creates_comment(self, mock_format, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 99999}
        mock_get_client.return_value = mock_client
        mock_format.return_value = "## Sentry Build Distribution\n..."

        artifact = self._create_artifact()

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "## Sentry Build Distribution\n..."},
        )

        # Verify comment ID stored on commit comparison
        artifact.commit_comparison.refresh_from_db()
        build_dist = artifact.commit_comparison.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is True
        assert build_dist["comment_id"] == "99999"

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_github_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_updates_existing_comment(self, mock_format, mock_get_client):
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_format.return_value = "updated body"

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
        )

        # Store existing comment on the commit comparison
        commit_comparison.extras = {
            "pr_comments": {"build_distribution": {"success": True, "comment_id": "existing_123"}}
        }
        commit_comparison.save(update_fields=["extras"])

        self._create_artifact(
            commit_comparison=commit_comparison,
            app_id="com.example.first",
        )

        # Second artifact for the same commit
        second = self._create_artifact(
            commit_comparison=commit_comparison,
            app_id="com.example.second",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
        )

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(second.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="existing_123",
            data={"body": "updated body"},
        )
        mock_client.create_comment.assert_not_called()

    def test_skips_when_no_commit_comparison(self):
        artifact = self._create_artifact(with_commit_comparison=False)

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        # No error — just returns early

    def test_skips_when_no_pr_number(self):
        artifact = self._create_artifact(pr_number=None)

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

    def test_skips_when_not_github(self):
        artifact = self._create_artifact(provider="gitlab")

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

    def test_skips_when_not_installable(self):
        artifact = self._create_artifact(installable_app_file_id=None, build_number=None)

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

    def test_skips_when_feature_flag_disabled(self):
        artifact = self._create_artifact()

        # Feature flag not enabled — should skip
        create_preprod_pr_comment_task(artifact.id)

    def test_skips_nonexistent_artifact(self):
        create_preprod_pr_comment_task(99999)

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_github_client")
    def test_skips_when_no_github_client(self, mock_get_client):
        mock_get_client.return_value = None
        artifact = self._create_artifact()

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_github_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_handles_api_error(self, mock_format, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.side_effect = ApiError("rate limited", code=429)
        mock_get_client.return_value = mock_client
        mock_format.return_value = "body"

        artifact = self._create_artifact()

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            with pytest.raises(ApiError):
                create_preprod_pr_comment_task(artifact.id)

        artifact.commit_comparison.refresh_from_db()
        build_dist = artifact.commit_comparison.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is False
        assert build_dist["error_type"] == "api_error"

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_github_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_reads_fresh_extras_via_select_for_update(self, mock_format, mock_get_client):
        """select_for_update gives a fresh DB read, so a comment_id written
        by a concurrent task between artifact load and row lock is found."""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_format.return_value = "updated body"

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="c" * 40,
            base_sha="d" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
        )

        artifact = self._create_artifact(commit_comparison=commit_comparison)

        # Simulate a concurrent task having written the comment_id to the DB
        # *after* this task loaded the artifact (and its commit_comparison).
        CommitComparison.objects.filter(id=commit_comparison.id).update(
            extras={
                "pr_comments": {
                    "build_distribution": {"success": True, "comment_id": "concurrent_456"}
                }
            }
        )

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="concurrent_456",
            data={"body": "updated body"},
        )
        mock_client.create_comment.assert_not_called()
