from __future__ import annotations

import uuid
from unittest.mock import Mock, patch

import pytest

from sentry.models.commitcomparison import CommitComparison
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.vcs.pr_comments.snapshot_tasks import create_preprod_snapshot_pr_comment_task
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test

_sentinel = object()


@cell_silo_test
class CreatePreprodSnapshotPrCommentTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )
        self._feature = "organizations:preprod-snapshot-pr-comments"

    def _create_artifact_with_metrics(
        self,
        pr_number: int | None = 42,
        provider: str = "github",
        app_id: str = "com.example.app",
        image_count: int = 10,
        commit_comparison: CommitComparison | None | object = _sentinel,
        with_commit_comparison: bool = True,
    ) -> tuple[PreprodArtifact, PreprodSnapshotMetrics]:
        if commit_comparison is _sentinel:
            if with_commit_comparison:
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
            else:
                commit_comparison = None

        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id=app_id,
            commit_comparison=commit_comparison,
            app_name="TestApp",
            build_version="1.0.0",
            build_number=1,
        )
        metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=image_count,
        )

        artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=artifact.id)

        return artifact, metrics

    def _create_repo(self) -> Repository:
        return Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
        )

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_creates_comment(self, mock_format, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 99999}
        mock_get_client.return_value = mock_client
        mock_format.return_value = "## Sentry Snapshot Testing\n..."

        artifact, metrics = self._create_artifact_with_metrics()

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "## Sentry Snapshot Testing\n..."},
        )

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        snapshots = artifact.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is True
        assert snapshots["comment_id"] == "99999"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
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
            extras={"pr_comments": {"snapshots": {"success": True, "comment_id": "existing_123"}}},
        )

        artifact, metrics = self._create_artifact_with_metrics(
            commit_comparison=commit_comparison,
        )

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="existing_123",
            data={"body": "updated body"},
        )
        mock_client.create_comment.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_no_commit_comparison(self, mock_get_client):
        artifact, metrics = self._create_artifact_with_metrics(with_commit_comparison=False)

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_get_client.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_no_pr_number(self, mock_get_client):
        artifact, metrics = self._create_artifact_with_metrics(pr_number=None)

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_get_client.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_no_client(self, mock_get_client):
        mock_get_client.return_value = None
        artifact, metrics = self._create_artifact_with_metrics()

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_get_client.assert_called_once()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_no_snapshot_metrics(self, mock_get_client):
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Create artifact without snapshot metrics
        unique = str(uuid.uuid4()).replace("-", "")[:8]
        cc = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha=unique.ljust(40, "a"),
            base_sha=unique.ljust(40, "b"),
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=cc,
        )

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_not_called()
        mock_client.update_comment.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_project_option_disabled(self, mock_get_client):
        self.project.update_option("sentry:preprod_snapshot_pr_comments_enabled", False)
        artifact, metrics = self._create_artifact_with_metrics()

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_get_client.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_feature_flag_disabled(self, mock_get_client):
        artifact, metrics = self._create_artifact_with_metrics()

        create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_get_client.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_nonexistent_artifact(self, mock_get_client):
        create_preprod_snapshot_pr_comment_task(99999)

        mock_get_client.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_handles_api_error(self, mock_format, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.side_effect = ApiError("rate limited", code=429)
        mock_get_client.return_value = mock_client
        mock_format.return_value = "body"

        artifact, metrics = self._create_artifact_with_metrics()

        with self.feature(self._feature):
            with pytest.raises(ApiError):
                create_preprod_snapshot_pr_comment_task(artifact.id)

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        snapshots = artifact.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is False
        assert snapshots["error_type"] == "api_error"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_retry_after_update_failure_uses_update(self, mock_format, mock_get_client):
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
            extras={"pr_comments": {"snapshots": {"success": True, "comment_id": "orig_789"}}},
        )

        artifact, metrics = self._create_artifact_with_metrics(
            commit_comparison=commit_comparison,
        )

        # First call: update fails
        mock_client.update_comment.side_effect = ApiError("server error", code=500)

        with self.feature(self._feature):
            with pytest.raises(ApiError):
                create_preprod_snapshot_pr_comment_task(artifact.id)

        commit_comparison.refresh_from_db()
        snapshots = commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is False
        assert snapshots["comment_id"] == "orig_789"

        # Second call (retry): should use update_comment
        mock_client.reset_mock()
        mock_client.update_comment.side_effect = None

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="orig_789",
            data={"body": "body"},
        )
        mock_client.create_comment.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_retry_after_create_failure_creates_again(self, mock_format, mock_get_client):
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_format.return_value = "body"

        artifact, metrics = self._create_artifact_with_metrics()

        # First call: create fails
        mock_client.create_comment.side_effect = ApiError("server error", code=500)

        with self.feature(self._feature):
            with pytest.raises(ApiError):
                create_preprod_snapshot_pr_comment_task(artifact.id)

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        snapshots = artifact.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is False
        assert "comment_id" not in snapshots

        # Second call (retry): should create again
        mock_client.reset_mock()
        mock_client.create_comment.side_effect = None
        mock_client.create_comment.return_value = {"id": 77777}

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "body"},
        )
        mock_client.update_comment.assert_not_called()

        artifact.commit_comparison.refresh_from_db()
        snapshots = artifact.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is True
        assert snapshots["comment_id"] == "77777"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_reads_fresh_extras_via_select_for_update(self, mock_format, mock_get_client):
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

        artifact, metrics = self._create_artifact_with_metrics(
            commit_comparison=commit_comparison,
        )

        # Simulate a concurrent task writing a comment_id after artifact load
        CommitComparison.objects.filter(id=commit_comparison.id).update(
            extras={"pr_comments": {"snapshots": {"success": True, "comment_id": "concurrent_456"}}}
        )

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="concurrent_456",
            data={"body": "updated body"},
        )
        mock_client.create_comment.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_updates_comment_from_previous_commit(self, mock_format, mock_get_client):
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
                "pr_comments": {"snapshots": {"success": True, "comment_id": "prev_commit_123"}}
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

        artifact, metrics = self._create_artifact_with_metrics(commit_comparison=cc_b)

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="prev_commit_123",
            data={"body": "updated body"},
        )
        mock_client.create_comment.assert_not_called()

        # comment_id stored on cc_b as well
        cc_b.refresh_from_db()
        snapshots = cc_b.extras["pr_comments"]["snapshots"]
        assert snapshots["comment_id"] == "prev_commit_123"

        # cc_a unchanged
        cc_a.refresh_from_db()
        assert cc_a.extras["pr_comments"]["snapshots"]["comment_id"] == "prev_commit_123"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_creates_when_no_sibling_has_comment_id(self, mock_format, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 55555}
        mock_get_client.return_value = mock_client
        mock_format.return_value = "new body"

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

        artifact, metrics = self._create_artifact_with_metrics(commit_comparison=cc_b)

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "new body"},
        )
        mock_client.update_comment.assert_not_called()

        cc_b.refresh_from_db()
        snapshots = cc_b.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is True
        assert snapshots["comment_id"] == "55555"
