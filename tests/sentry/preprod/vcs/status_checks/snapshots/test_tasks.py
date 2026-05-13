from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.utils import build_changes_map
from sentry.preprod.vcs.status_checks.snapshots.tasks import (
    _compute_snapshot_status,
    create_preprod_snapshot_status_check_task,
    post_snapshot_status_check_task,
)
from sentry.preprod.vcs.status_checks.snapshots.templates import (
    format_snapshot_status_check_messages,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


class SnapshotTasksTestBase(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.commit_comparison = self.create_commit_comparison()

    def _make_artifact_with_comparison(
        self,
        images_changed=0,
        images_added=0,
        images_removed=0,
        images_renamed=0,
        state=PreprodSnapshotComparison.State.SUCCESS,
    ):
        artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=self.commit_comparison,
        )
        head_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact, image_count=10
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=self.commit_comparison,
        )
        base_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=base_artifact, image_count=10
        )
        comparison = PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=state,
            images_changed=images_changed,
            images_added=images_added,
            images_removed=images_removed,
            images_renamed=images_renamed,
            images_unchanged=10,
        )
        return artifact, head_metrics, comparison


@cell_silo_test
class ComputeSnapshotStatusTest(SnapshotTasksTestBase):
    def _status_with_changes_map(self, artifact, metrics, approvals=None, **flags):
        artifacts = [artifact]
        metrics_map = {artifact.id: metrics}
        comparisons_map = {metrics.id: _get_comparison(metrics)}
        changes_map = build_changes_map(artifacts, metrics_map, comparisons_map, **flags)
        return _compute_snapshot_status(
            artifacts, metrics_map, comparisons_map, approvals or {}, changes_map
        )

    def test_images_added_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_added=5)
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.SUCCESS

    def test_images_added_fails_when_flag_on(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_added=5)
        assert (
            self._status_with_changes_map(artifact, metrics, fail_on_added=True)
            == StatusCheckStatus.FAILURE
        )

    def test_images_removed_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_removed=3)
        assert (
            self._status_with_changes_map(artifact, metrics, fail_on_removed=False)
            == StatusCheckStatus.SUCCESS
        )

    def test_images_removed_fails_by_default(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_removed=3)
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.FAILURE

    def test_images_changed_fails_by_default(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_changed=2)
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.FAILURE

    def test_images_changed_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_changed=2)
        assert (
            self._status_with_changes_map(artifact, metrics, fail_on_changed=False)
            == StatusCheckStatus.SUCCESS
        )

    def test_images_renamed_ignored_by_default(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_renamed=1)
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.SUCCESS

    def test_images_renamed_fails_when_flag_on(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_renamed=1)
        assert (
            self._status_with_changes_map(artifact, metrics, fail_on_renamed=True)
            == StatusCheckStatus.FAILURE
        )

    def test_no_changes_succeeds(self):
        artifact, metrics, _ = self._make_artifact_with_comparison()
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.SUCCESS


@cell_silo_test
class BuildChangesMapTest(SnapshotTasksTestBase):
    def test_added_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_added=5)
        changes_map = build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: _get_comparison(metrics)}
        )
        assert not any(changes_map.values())

    def test_added_detected_when_flag_on(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_added=5)
        changes_map = build_changes_map(
            [artifact],
            {artifact.id: metrics},
            {metrics.id: _get_comparison(metrics)},
            fail_on_added=True,
        )
        assert changes_map[artifact.id] is True

    def test_removed_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_removed=3)
        changes_map = build_changes_map(
            [artifact],
            {artifact.id: metrics},
            {metrics.id: _get_comparison(metrics)},
            fail_on_removed=False,
        )
        assert not any(changes_map.values())

    def test_removed_detected_by_default(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_removed=3)
        changes_map = build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: _get_comparison(metrics)}
        )
        assert changes_map[artifact.id] is True

    def test_changed_detected_by_default(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_changed=2)
        changes_map = build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: _get_comparison(metrics)}
        )
        assert changes_map[artifact.id] is True

    def test_changed_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_changed=2)
        changes_map = build_changes_map(
            [artifact],
            {artifact.id: metrics},
            {metrics.id: _get_comparison(metrics)},
            fail_on_changed=False,
        )
        assert not any(changes_map.values())

    def test_renamed_ignored_by_default(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_renamed=1)
        changes_map = build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: _get_comparison(metrics)}
        )
        assert not any(changes_map.values())

    def test_renamed_detected_when_flag_on(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_renamed=1)
        changes_map = build_changes_map(
            [artifact],
            {artifact.id: metrics},
            {metrics.id: _get_comparison(metrics)},
            fail_on_renamed=True,
        )
        assert changes_map[artifact.id] is True


@cell_silo_test
class SnapshotStatusCheckWithSkippedTest(SnapshotTasksTestBase):
    def _make_comparison_and_format(self, images_changed=0, images_skipped=0, images_unchanged=0):
        artifact = self.create_preprod_artifact(
            project=self.project, commit_comparison=self.commit_comparison
        )
        head_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact, image_count=10
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project, commit_comparison=self.commit_comparison
        )
        PreprodSnapshotMetrics.objects.create(preprod_artifact=base_artifact, image_count=10)
        comparison = PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=PreprodSnapshotMetrics.objects.get(
                preprod_artifact=base_artifact
            ),
            state=PreprodSnapshotComparison.State.SUCCESS,
            images_changed=images_changed,
            images_skipped=images_skipped,
            images_unchanged=images_unchanged,
        )
        has_changes = images_changed > 0
        status = StatusCheckStatus.FAILURE if has_changes else StatusCheckStatus.SUCCESS
        _, subtitle, summary = format_snapshot_status_check_messages(
            artifacts=[artifact],
            snapshot_metrics_map={artifact.id: head_metrics},
            comparisons_map={head_metrics.id: comparison},
            overall_status=status,
            base_artifact_map={artifact.id: base_artifact},
            changes_map={artifact.id: has_changes},
            project=self.project,
        )
        return subtitle, summary

    def test_changes_with_skipped_in_subtitle_and_summary(self):
        subtitle, summary = self._make_comparison_and_format(
            images_changed=2, images_skipped=50, images_unchanged=3
        )

        assert "2 changed" in subtitle
        assert "50 skipped" in subtitle
        assert "3 unchanged" in subtitle
        assert "Skipped" in summary
        assert "50" in summary

    def test_no_changes_with_skipped(self):
        subtitle, _ = self._make_comparison_and_format(images_skipped=300, images_unchanged=5)

        assert subtitle == "No changes detected, 300 skipped"

    def test_skipped_does_not_require_approval(self):
        artifact, metrics, _ = self._make_artifact_with_comparison()
        comparison = _get_comparison(metrics)
        comparison.images_skipped = 100
        comparison.save(update_fields=["images_skipped"])

        changes_map = build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: comparison}
        )
        assert changes_map[artifact.id] is False

        status = _compute_snapshot_status(
            [artifact], {artifact.id: metrics}, {metrics.id: comparison}, {}, changes_map
        )
        assert status == StatusCheckStatus.SUCCESS


def _get_comparison(metrics: PreprodSnapshotMetrics) -> PreprodSnapshotComparison:
    return PreprodSnapshotComparison.objects.get(head_snapshot_metrics=metrics)


TASK_MODULE = "sentry.preprod.vcs.status_checks.snapshots.tasks"


@cell_silo_test
class PostSnapshotStatusCheckTaskTest(TestCase):
    def setUp(self):
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
        )
        self.artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=self.commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

    def _call_task(self, **overrides):
        defaults = {
            "preprod_artifact_id": self.artifact.id,
            "status": StatusCheckStatus.SUCCESS.value,
            "title": "Snapshots",
            "subtitle": "No changes",
            "summary": "All good",
            "external_id": str(self.artifact.id),
            "started_at_iso": self.artifact.date_added.isoformat(),
            "completed_at_iso": self.artifact.date_updated.isoformat(),
            "target_url": "https://sentry.io/test",
            "approve_action_identifier": None,
        }
        defaults.update(overrides)
        post_snapshot_status_check_task(**defaults)

    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_success(self, mock_get_client, mock_get_provider):
        mock_provider = Mock()
        mock_provider.create_status_check.return_value = "check_123"
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = mock_provider

        self._call_task()

        mock_provider.create_status_check.assert_called_once()
        self.artifact.refresh_from_db()
        assert self.artifact.extras is not None
        checks = self.artifact.extras["posted_status_checks"]["snapshots"]
        assert checks["success"] is True
        assert checks["check_id"] == "check_123"

    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_api_error_records_failure_and_reraises(self, mock_get_client, mock_get_provider):
        mock_provider = Mock()
        mock_provider.create_status_check.side_effect = ApiError("rate limited", code=429)
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = mock_provider

        with pytest.raises(ApiError):
            self._call_task()

        self.artifact.refresh_from_db()
        assert self.artifact.extras is not None
        checks = self.artifact.extras["posted_status_checks"]["snapshots"]
        assert checks["success"] is False
        assert checks["error_type"] == "api_error"

    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_null_check_id_records_failure(self, mock_get_client, mock_get_provider):
        mock_provider = Mock()
        mock_provider.create_status_check.return_value = None
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = mock_provider

        self._call_task()

        self.artifact.refresh_from_db()
        assert self.artifact.extras is not None
        checks = self.artifact.extras["posted_status_checks"]["snapshots"]
        assert checks["success"] is False

    def test_nonexistent_artifact_returns_early(self):
        self._call_task(preprod_artifact_id=99999)

    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_no_client_returns_early(self, mock_get_client):
        mock_get_client.return_value = (None, None)
        self._call_task()

    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_permanent_4xx_does_not_reraise(self, mock_get_client, mock_get_provider):
        mock_provider = Mock()
        mock_provider.create_status_check.side_effect = ApiError("not found", code=404)
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = mock_provider

        self._call_task()

        self.artifact.refresh_from_db()
        assert self.artifact.extras is not None
        checks = self.artifact.extras["posted_status_checks"]["snapshots"]
        assert checks["success"] is False

    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_no_provider_returns_early(self, mock_get_client, mock_get_provider):
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = None
        self._call_task()


@cell_silo_test
class CreateSnapshotStatusCheckGracePeriodTest(SnapshotTasksTestBase):
    def _create_solo_head_artifact(self):
        commit_comparison = self.create_commit_comparison(
            head_sha="head123" + "0" * 33,
            base_sha="base456" + "0" * 33,
            head_repo_name="getsentry/sentry",
            provider="github",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=commit_comparison,
            app_id="com.example.app",
        )
        PreprodSnapshotMetrics.objects.create(preprod_artifact=artifact, image_count=10)

        prev_comparison = self.create_commit_comparison(
            head_sha="prev123" + "0" * 33,
            base_sha="prev456" + "0" * 33,
            head_repo_name="getsentry/sentry",
            provider="github",
        )
        prev_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=prev_comparison,
            app_id="com.example.app",
        )
        PreprodSnapshotMetrics.objects.create(preprod_artifact=prev_artifact, image_count=10)

        return artifact

    @patch(f"{TASK_MODULE}.post_snapshot_status_check_task")
    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    @patch(f"{TASK_MODULE}.create_preprod_snapshot_status_check_task.apply_async")
    def test_missing_base_first_attempt_posts_in_progress(
        self, mock_apply_async, mock_get_client, mock_get_provider, mock_post_task
    ):
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = Mock()

        artifact = self._create_solo_head_artifact()

        create_preprod_snapshot_status_check_task(
            preprod_artifact_id=artifact.id,
            caller="test",
        )

        mock_post_task.delay.assert_called_once()
        call_kwargs = mock_post_task.delay.call_args[1]
        assert call_kwargs["status"] == StatusCheckStatus.IN_PROGRESS.value

        mock_apply_async.assert_called_once()
        async_kwargs = mock_apply_async.call_args[1]
        assert async_kwargs["kwargs"]["is_timeout_check"] is True
        assert async_kwargs["kwargs"]["preprod_artifact_id"] == artifact.id
        assert async_kwargs["countdown"] == 600

    @patch(f"{TASK_MODULE}.post_snapshot_status_check_task")
    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_missing_base_timeout_posts_failure(
        self, mock_get_client, mock_get_provider, mock_post_task
    ):
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = Mock()

        artifact = self._create_solo_head_artifact()

        create_preprod_snapshot_status_check_task(
            preprod_artifact_id=artifact.id,
            caller="missing_base_timeout",
            is_timeout_check=True,
        )

        mock_post_task.delay.assert_called_once()
        call_kwargs = mock_post_task.delay.call_args[1]
        assert call_kwargs["status"] == StatusCheckStatus.FAILURE.value

    @patch(f"{TASK_MODULE}.post_snapshot_status_check_task")
    @patch(f"{TASK_MODULE}.get_status_check_provider")
    @patch(f"{TASK_MODULE}.get_status_check_client")
    def test_timeout_with_base_arrived_runs_normal_path(
        self, mock_get_client, mock_get_provider, mock_post_task
    ):
        mock_get_client.return_value = (Mock(), Mock())
        mock_get_provider.return_value = Mock()

        artifact = self._create_solo_head_artifact()
        metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact)

        base_cc = self.create_commit_comparison(
            head_sha="base456" + "0" * 33,
            head_repo_name="getsentry/sentry",
            provider="github",
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=base_cc,
            app_id="com.example.app",
        )
        base_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=base_artifact,
            image_count=10,
        )
        PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.SUCCESS,
            images_changed=0,
            images_added=0,
            images_removed=0,
            images_renamed=0,
            images_unchanged=10,
            images_skipped=0,
        )

        create_preprod_snapshot_status_check_task(
            preprod_artifact_id=artifact.id,
            caller="missing_base_timeout",
            is_timeout_check=True,
        )

        mock_post_task.delay.assert_called_once()
        call_kwargs = mock_post_task.delay.call_args[1]
        assert call_kwargs["status"] == StatusCheckStatus.SUCCESS.value
