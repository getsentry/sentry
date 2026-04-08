from __future__ import annotations

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.vcs.status_checks.snapshots.tasks import (
    _build_changes_map,
    _compute_snapshot_status,
)
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
        changes_map = _build_changes_map(artifacts, metrics_map, comparisons_map, **flags)
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

    def test_images_changed_always_fails(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_changed=2)
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.FAILURE

    def test_images_renamed_always_fails(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_renamed=1)
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.FAILURE

    def test_no_changes_succeeds(self):
        artifact, metrics, _ = self._make_artifact_with_comparison()
        assert self._status_with_changes_map(artifact, metrics) == StatusCheckStatus.SUCCESS


@cell_silo_test
class BuildChangesMapTest(SnapshotTasksTestBase):
    def test_added_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_added=5)
        changes_map = _build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: _get_comparison(metrics)}
        )
        assert not any(changes_map.values())

    def test_added_detected_when_flag_on(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_added=5)
        changes_map = _build_changes_map(
            [artifact],
            {artifact.id: metrics},
            {metrics.id: _get_comparison(metrics)},
            fail_on_added=True,
        )
        assert changes_map[artifact.id] is True

    def test_removed_ignored_when_flag_off(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_removed=3)
        changes_map = _build_changes_map(
            [artifact],
            {artifact.id: metrics},
            {metrics.id: _get_comparison(metrics)},
            fail_on_removed=False,
        )
        assert not any(changes_map.values())

    def test_removed_detected_by_default(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_removed=3)
        changes_map = _build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: _get_comparison(metrics)}
        )
        assert changes_map[artifact.id] is True

    def test_changed_always_detected(self):
        artifact, metrics, _ = self._make_artifact_with_comparison(images_changed=2)
        changes_map = _build_changes_map(
            [artifact], {artifact.id: metrics}, {metrics.id: _get_comparison(metrics)}
        )
        assert changes_map[artifact.id] is True


def _get_comparison(metrics: PreprodSnapshotMetrics) -> PreprodSnapshotComparison:
    return PreprodSnapshotComparison.objects.get(head_snapshot_metrics=metrics)
