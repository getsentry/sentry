from __future__ import annotations

import uuid
from unittest.mock import Mock, patch

import pytest

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.vcs.pr_comments.snapshot_tasks import (
    create_preprod_snapshot_pr_comment_task,
    post_snapshot_pr_comment_task,
)
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
        self.project.update_option("sentry:preprod_snapshot_pr_comments_enabled", True)

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

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.post_snapshot_pr_comment_task.delay")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.build_changes_map")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_dispatches_subtask(
        self, mock_format, mock_get_client, mock_build_changes_map, mock_delay
    ):
        mock_get_client.return_value = Mock()
        mock_format.return_value = "## Sentry Snapshot Testing\n..."

        artifact, metrics = self._create_artifact_with_metrics()
        mock_build_changes_map.return_value = {artifact.id: True}

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        assert artifact.commit_comparison is not None
        mock_delay.assert_called_once_with(
            organization_id=self.organization.id,
            repo_name="owner/repo",
            provider="github",
            pr_number=42,
            commit_comparison_id=artifact.commit_comparison.id,
            artifact_id=artifact.id,
            comment_body="## Sentry Snapshot Testing\n...",
            existing_comment_id=None,
        )

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.post_snapshot_pr_comment_task.delay")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.build_changes_map")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_dispatches_with_existing_comment_id(
        self, mock_format, mock_get_client, mock_build_changes_map, mock_delay
    ):
        mock_get_client.return_value = Mock()
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
        mock_build_changes_map.return_value = {artifact.id: True}

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_delay.assert_called_once()
        assert mock_delay.call_args.kwargs["existing_comment_id"] == "existing_123"

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

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_no_changes(self, mock_get_client, mock_format):
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        artifact, metrics = self._create_artifact_with_metrics()

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_client.create_comment.assert_not_called()
        mock_client.update_comment.assert_not_called()
        mock_format.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.post_snapshot_pr_comment_task.delay")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_posts_when_comparison_failed(self, mock_get_client, mock_format, mock_delay):
        mock_get_client.return_value = Mock()
        mock_format.return_value = "body"

        artifact, metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(
            with_commit_comparison=False, app_id="com.example.base"
        )
        PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.FAILED,
        )

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_delay.assert_called_once()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_feature_flag_disabled(self, mock_get_client):
        artifact, metrics = self._create_artifact_with_metrics()

        create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_get_client.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_nonexistent_artifact(self, mock_get_client):
        create_preprod_snapshot_pr_comment_task(99999)

        mock_get_client.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.post_snapshot_pr_comment_task.delay")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.build_changes_map")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_reads_fresh_extras_via_select_for_update(
        self, mock_format, mock_get_client, mock_build_changes_map, mock_delay
    ):
        mock_get_client.return_value = Mock()
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
        mock_build_changes_map.return_value = {artifact.id: True}

        CommitComparison.objects.filter(id=commit_comparison.id).update(
            extras={"pr_comments": {"snapshots": {"success": True, "comment_id": "concurrent_456"}}}
        )

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_delay.assert_called_once()
        assert mock_delay.call_args.kwargs["existing_comment_id"] == "concurrent_456"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.post_snapshot_pr_comment_task.delay")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.build_changes_map")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_updates_comment_from_previous_commit(
        self, mock_format, mock_get_client, mock_build_changes_map, mock_delay
    ):
        mock_get_client.return_value = Mock()
        mock_format.return_value = "updated body"

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
            extras={
                "pr_comments": {"snapshots": {"success": True, "comment_id": "prev_commit_123"}}
            },
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
        mock_build_changes_map.return_value = {artifact.id: True}

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_delay.assert_called_once()
        assert mock_delay.call_args.kwargs["existing_comment_id"] == "prev_commit_123"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.post_snapshot_pr_comment_task.delay")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.build_changes_map")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_passes_post_on_options_to_build_changes_map(
        self, mock_format, mock_get_client, mock_build_changes_map, mock_delay
    ):
        mock_get_client.return_value = Mock()
        mock_format.return_value = "body"

        self.project.update_option("sentry:preprod_snapshot_pr_comments_post_on_added", True)
        self.project.update_option("sentry:preprod_snapshot_pr_comments_post_on_removed", False)
        self.project.update_option("sentry:preprod_snapshot_pr_comments_post_on_changed", False)
        self.project.update_option("sentry:preprod_snapshot_pr_comments_post_on_renamed", True)

        artifact, metrics = self._create_artifact_with_metrics()
        mock_build_changes_map.return_value = {artifact.id: True}

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_build_changes_map.assert_called_once()
        kwargs = mock_build_changes_map.call_args
        assert kwargs[1]["fail_on_added"] is True
        assert kwargs[1]["fail_on_removed"] is False
        assert kwargs[1]["fail_on_changed"] is False
        assert kwargs[1]["fail_on_renamed"] is True

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.post_snapshot_pr_comment_task.delay")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.build_changes_map")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.format_snapshot_pr_comment")
    def test_creates_when_no_sibling_has_comment_id(
        self, mock_format, mock_get_client, mock_build_changes_map, mock_delay
    ):
        mock_get_client.return_value = Mock()
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
        mock_build_changes_map.return_value = {artifact.id: True}

        with self.feature(self._feature):
            create_preprod_snapshot_pr_comment_task(artifact.id)

        mock_delay.assert_called_once()
        assert mock_delay.call_args.kwargs["existing_comment_id"] is None


@cell_silo_test
class PostSnapshotPrCommentTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.commit_comparison = CommitComparison.objects.create(
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

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_creates_comment(self, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 99999}
        mock_get_client.return_value = mock_client

        post_snapshot_pr_comment_task(
            organization_id=self.organization.id,
            repo_name="owner/repo",
            provider="github",
            pr_number=42,
            commit_comparison_id=self.commit_comparison.id,
            comment_body="## Sentry Snapshot Testing\n...",
            existing_comment_id=None,
        )

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "## Sentry Snapshot Testing\n..."},
        )

        self.commit_comparison.refresh_from_db()
        snapshots = self.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is True
        assert snapshots["comment_id"] == "99999"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_updates_existing_comment(self, mock_get_client):
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        post_snapshot_pr_comment_task(
            organization_id=self.organization.id,
            repo_name="owner/repo",
            provider="github",
            pr_number=42,
            commit_comparison_id=self.commit_comparison.id,
            comment_body="updated body",
            existing_comment_id="existing_123",
        )

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="existing_123",
            data={"body": "updated body"},
        )
        mock_client.create_comment.assert_not_called()

        self.commit_comparison.refresh_from_db()
        snapshots = self.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is True
        assert snapshots["comment_id"] == "existing_123"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_handles_api_error(self, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.side_effect = ApiError("rate limited", code=429)
        mock_get_client.return_value = mock_client

        with pytest.raises(ApiError):
            post_snapshot_pr_comment_task(
                organization_id=self.organization.id,
                repo_name="owner/repo",
                provider="github",
                pr_number=42,
                commit_comparison_id=self.commit_comparison.id,
                comment_body="body",
                existing_comment_id=None,
            )

        self.commit_comparison.refresh_from_db()
        snapshots = self.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is False
        assert snapshots["error_type"] == "api_error"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_preserves_comment_id_on_update_failure(self, mock_get_client):
        self.commit_comparison.extras = {
            "pr_comments": {"snapshots": {"success": True, "comment_id": "orig_789"}}
        }
        self.commit_comparison.save(update_fields=["extras"])

        mock_client = Mock()
        mock_client.update_comment.side_effect = ApiError("server error", code=500)
        mock_get_client.return_value = mock_client

        with pytest.raises(ApiError):
            post_snapshot_pr_comment_task(
                organization_id=self.organization.id,
                repo_name="owner/repo",
                provider="github",
                pr_number=42,
                commit_comparison_id=self.commit_comparison.id,
                comment_body="body",
                existing_comment_id="orig_789",
            )

        self.commit_comparison.refresh_from_db()
        snapshots = self.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is False
        assert snapshots["comment_id"] == "orig_789"

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_no_comment_id_on_create_failure(self, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.side_effect = ApiError("server error", code=500)
        mock_get_client.return_value = mock_client

        with pytest.raises(ApiError):
            post_snapshot_pr_comment_task(
                organization_id=self.organization.id,
                repo_name="owner/repo",
                provider="github",
                pr_number=42,
                commit_comparison_id=self.commit_comparison.id,
                comment_body="body",
                existing_comment_id=None,
            )

        self.commit_comparison.refresh_from_db()
        snapshots = self.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is False
        assert "comment_id" not in snapshots

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_permanent_4xx_does_not_reraise(self, mock_get_client):
        mock_client = Mock()
        mock_client.create_comment.side_effect = ApiError("forbidden", code=403)
        mock_get_client.return_value = mock_client

        post_snapshot_pr_comment_task(
            organization_id=self.organization.id,
            repo_name="owner/repo",
            provider="github",
            pr_number=42,
            commit_comparison_id=self.commit_comparison.id,
            comment_body="body",
            existing_comment_id=None,
        )

        self.commit_comparison.refresh_from_db()
        snapshots = self.commit_comparison.extras["pr_comments"]["snapshots"]
        assert snapshots["success"] is False

    @patch("sentry.preprod.vcs.pr_comments.snapshot_tasks.get_commit_context_client")
    def test_skips_when_no_client(self, mock_get_client):
        mock_get_client.return_value = None

        post_snapshot_pr_comment_task(
            organization_id=self.organization.id,
            repo_name="owner/repo",
            provider="github",
            pr_number=42,
            commit_comparison_id=self.commit_comparison.id,
            comment_body="body",
            existing_comment_id=None,
        )

    def test_skips_when_org_not_found(self):
        post_snapshot_pr_comment_task(
            organization_id=99999,
            repo_name="owner/repo",
            provider="github",
            pr_number=42,
            commit_comparison_id=self.commit_comparison.id,
            comment_body="body",
            existing_comment_id=None,
        )
