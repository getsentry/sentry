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

_sentinel = object()


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
        extras=_sentinel,
        commit_comparison=None,
    ) -> PreprodArtifact:
        if extras is _sentinel:
            if artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
                extras = {"is_code_signature_valid": True}
            else:
                extras = None
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

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
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
        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        build_dist = artifact.commit_comparison.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is True
        assert build_dist["comment_id"] == "99999"

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
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

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
    def test_skips_when_no_github_client(self, mock_get_client):
        mock_get_client.return_value = None
        artifact = self._create_artifact()

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
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

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        build_dist = artifact.commit_comparison.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is False
        assert build_dist["error_type"] == "api_error"

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_retry_after_update_failure_uses_update_not_create(self, mock_format, mock_get_client):
        """When update_comment fails, the stored comment_id must survive so
        that the retry calls update_comment again instead of create_comment."""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_format.return_value = "body"

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="e" * 40,
            base_sha="f" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
            extras={
                "pr_comments": {"build_distribution": {"success": True, "comment_id": "orig_789"}}
            },
        )

        artifact = self._create_artifact(commit_comparison=commit_comparison)

        # First call: update_comment fails
        mock_client.update_comment.side_effect = ApiError("server error", code=500)

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            with pytest.raises(ApiError):
                create_preprod_pr_comment_task(artifact.id)

        # comment_id must be preserved despite the failure
        commit_comparison.refresh_from_db()
        build_dist = commit_comparison.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is False
        assert build_dist["comment_id"] == "orig_789"

        # Second call (retry): should call update_comment, not create_comment
        mock_client.reset_mock()
        mock_client.update_comment.side_effect = None

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="orig_789",
            data={"body": "body"},
        )
        mock_client.create_comment.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_retry_after_create_failure_creates_again(self, mock_format, mock_get_client):
        """When create_comment fails, no comment_id is stored, so the retry
        calls create_comment again rather than update_comment."""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_format.return_value = "body"

        artifact = self._create_artifact()

        # First call: create_comment fails
        mock_client.create_comment.side_effect = ApiError("server error", code=500)

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            with pytest.raises(ApiError):
                create_preprod_pr_comment_task(artifact.id)

        # No comment_id should be stored
        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        build_dist = artifact.commit_comparison.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is False
        assert "comment_id" not in build_dist

        # Second call (retry): should call create_comment again
        mock_client.reset_mock()
        mock_client.create_comment.side_effect = None
        mock_client.create_comment.return_value = {"id": 77777}

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "body"},
        )
        mock_client.update_comment.assert_not_called()

        # Now the comment_id should be stored
        artifact.commit_comparison.refresh_from_db()
        build_dist = artifact.commit_comparison.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is True
        assert build_dist["comment_id"] == "77777"

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
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

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_updates_comment_from_previous_commit(self, mock_format, mock_get_client):
        """When a previous commit on the same PR already has a comment_id,
        a new commit should update that comment instead of creating a new one."""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_format.return_value = "updated body"

        # Commit A already posted a comment
        cc_a = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
            extras={
                "pr_comments": {
                    "build_distribution": {"success": True, "comment_id": "prev_commit_123"}
                }
            },
        )

        # Commit B on the same PR — no comment_id yet
        cc_b = CommitComparison.objects.create(
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

        artifact = self._create_artifact(commit_comparison=cc_b)

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="prev_commit_123",
            data={"body": "updated body"},
        )
        mock_client.create_comment.assert_not_called()

        # comment_id stored on cc_b as well
        cc_b.refresh_from_db()
        build_dist = cc_b.extras["pr_comments"]["build_distribution"]
        assert build_dist["comment_id"] == "prev_commit_123"

        # cc_a unchanged
        cc_a.refresh_from_db()
        assert cc_a.extras["pr_comments"]["build_distribution"]["comment_id"] == "prev_commit_123"

    @patch("sentry.preprod.vcs.pr_comments.tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.tasks.format_pr_comment")
    def test_creates_comment_when_no_sibling_has_comment_id(self, mock_format, mock_get_client):
        """When multiple commits exist on the same PR but none has a
        comment_id, a new comment should be created."""
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 55555}
        mock_get_client.return_value = mock_client
        mock_format.return_value = "new body"

        # Two commits on the same PR, neither with a comment_id
        CommitComparison.objects.create(
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

        cc_b = CommitComparison.objects.create(
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

        artifact = self._create_artifact(commit_comparison=cc_b)

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "new body"},
        )
        mock_client.update_comment.assert_not_called()

        cc_b.refresh_from_db()
        build_dist = cc_b.extras["pr_comments"]["build_distribution"]
        assert build_dist["success"] is True
        assert build_dist["comment_id"] == "55555"

    def test_skips_xcarchive_without_valid_code_signature(self):
        artifact = self._create_artifact(extras={"is_code_signature_valid": False})

        with self.feature("organizations:preprod-build-distribution-pr-comments"):
            create_preprod_pr_comment_task(artifact.id)

        # No comment posted — task returns early because artifact is not installable
