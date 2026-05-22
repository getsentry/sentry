from __future__ import annotations

import pytest

from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.vcs.pr_comments.snapshot_templates import (
    format_missing_base_snapshot_pr_comment,
    format_snapshot_pr_comment,
    format_solo_snapshot_pr_comment,
    format_waiting_for_base_snapshot_pr_comment,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


class SnapshotPrCommentTestBase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )

    def _create_artifact_with_metrics(
        self,
        app_id: str = "com.example.app",
        app_name: str | None = None,
        build_version: str = "1.0.0",
        build_number: int = 1,
        image_count: int = 10,
    ) -> tuple[PreprodArtifact, PreprodSnapshotMetrics]:
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id=app_id,
            app_name=app_name,
            build_version=build_version,
            build_number=build_number,
        )
        metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=image_count,
        )
        return artifact, metrics

    def _create_comparison(
        self,
        head_metrics: PreprodSnapshotMetrics,
        base_metrics: PreprodSnapshotMetrics,
        state: int = PreprodSnapshotComparison.State.SUCCESS,
        images_changed: int = 0,
        images_added: int = 0,
        images_removed: int = 0,
        images_renamed: int = 0,
        images_unchanged: int = 10,
    ) -> PreprodSnapshotComparison:
        return PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=state,
            images_changed=images_changed,
            images_added=images_added,
            images_removed=images_removed,
            images_renamed=images_renamed,
            images_unchanged=images_unchanged,
        )

    def _create_approval(self, artifact: PreprodArtifact) -> PreprodComparisonApproval:
        return PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )


@cell_silo_test
class FormatSnapshotPrCommentEmptyTest(SnapshotPrCommentTestBase):
    def test_empty_artifacts_raises(self) -> None:
        with pytest.raises(ValueError, match="Cannot format PR comment for empty artifact list"):
            format_snapshot_pr_comment([], {}, {}, {}, {}, project=self.project)


@cell_silo_test
class FormatSnapshotPrCommentProcessingTest(SnapshotPrCommentTestBase):
    def test_no_metrics_shows_processing(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
        )

        result = format_snapshot_pr_comment([artifact], {}, {}, {}, {}, project=self.project)

        assert "## Sentry Snapshot Testing" in result
        assert "Processing" in result
        assert "com.example.app" in result

    def test_no_comparison_with_base_shows_processing(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, _ = self._create_artifact_with_metrics(app_id="com.example.base")

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {},
            {head_artifact.id: base_artifact},
            {},
            project=self.project,
        )

        assert "Processing" in result

    def test_pending_comparison_shows_processing(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(app_id="com.example.head")
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, state=PreprodSnapshotComparison.State.PENDING
        )

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {},
            project=self.project,
        )

        assert "Processing" in result

    def test_processing_comparison_shows_processing(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(app_id="com.example.head")
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, state=PreprodSnapshotComparison.State.PROCESSING
        )

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {},
            project=self.project,
        )

        assert "Processing" in result


@cell_silo_test
class FormatSnapshotPrCommentFailedTest(SnapshotPrCommentTestBase):
    def test_failed_comparison_shows_failure(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(app_id="com.example.head")
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, state=PreprodSnapshotComparison.State.FAILED
        )

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {},
            project=self.project,
        )

        assert "Comparison failed" in result
        assert "com.example.head" in result


@cell_silo_test
class FormatSnapshotPrCommentSuccessTest(SnapshotPrCommentTestBase):
    def test_no_changes_shows_unchanged(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App"
        )
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=0,
            images_added=0,
            images_removed=0,
            images_unchanged=10,
        )

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {},
            project=self.project,
        )

        assert "## Sentry Snapshot Testing" in result
        assert "Unchanged" in result
        assert "My App" in result
        assert "`com.example.app`" in result
        # Zero counts are plain text, non-zero unchanged is linked
        assert "| 0 | 0 | 0 | 0 |" in result
        assert "| 0 | ✅ Unchanged |" in result
        assert "?selectedTypes=unchanged" in result

    def test_changes_show_needs_approval(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=3,
            images_added=2,
            images_removed=1,
            images_renamed=1,
            images_unchanged=5,
        )

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {head_artifact.id: True},
            project=self.project,
        )

        assert "Needs approval" in result
        assert "?selectedTypes=added" in result
        assert "?selectedTypes=removed" in result
        assert "?selectedTypes=changed" in result
        assert "?selectedTypes=renamed" in result

    def test_approved_shows_approved_status(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=3,
            images_unchanged=7,
        )
        approval = self._create_approval(head_artifact)

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {head_artifact.id: True},
            approvals_map={head_artifact.id: approval},
            project=self.project,
        )

        assert "Approved" in result
        assert "Needs approval" not in result

    def test_multiple_artifacts(self) -> None:
        artifacts = []
        snapshot_metrics_map: dict[int, PreprodSnapshotMetrics] = {}
        comparisons_map: dict[int, PreprodSnapshotComparison] = {}
        base_artifact_map: dict[int, PreprodArtifact] = {}

        for i in range(3):
            head_artifact, head_metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.app{i}", build_number=i + 1
            )
            base_artifact, base_metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.base{i}", build_number=i + 10
            )
            comparison = self._create_comparison(head_metrics, base_metrics)

            artifacts.append(head_artifact)
            snapshot_metrics_map[head_artifact.id] = head_metrics
            comparisons_map[head_metrics.id] = comparison
            base_artifact_map[head_artifact.id] = base_artifact

        result = format_snapshot_pr_comment(
            artifacts,
            snapshot_metrics_map,
            comparisons_map,
            base_artifact_map,
            {},
            project=self.project,
        )

        for i in range(3):
            assert f"com.example.app{i}" in result

    def test_section_links_include_artifact_url(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=1,
            images_unchanged=9,
        )

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {head_artifact.id: True},
            project=self.project,
        )

        assert f"/preprod/snapshots/{head_artifact.id}" in result
        assert "?selectedTypes=changed" in result

    def test_zero_counts_are_not_linked(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=0,
            images_added=0,
            images_removed=0,
            images_unchanged=0,
        )

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {head_artifact.id: base_artifact},
            {},
            project=self.project,
        )

        assert "?selectedTypes=" not in result

    def test_table_header_present(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(head_metrics, base_metrics)

        result = format_snapshot_pr_comment(
            [head_artifact],
            {head_artifact.id: head_metrics},
            {head_metrics.id: comparison},
            {},
            {},
            project=self.project,
        )

        assert (
            "| Name | Added | Removed | Changed | Renamed | Unchanged | Skipped | Status |"
            in result
        )

    def test_settings_link_included(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics()

        result = format_snapshot_pr_comment(
            [artifact], {artifact.id: metrics}, {}, {}, {}, project=self.project
        )

        assert f"/settings/projects/{self.project.slug}/mobile-builds/" in result
        assert "tab=snapshots" in result
        assert f"{self.project.name} Snapshot Settings" in result


@cell_silo_test
class FormatSnapshotPrCommentNoBaseTest(SnapshotPrCommentTestBase):
    def test_no_base_shows_uploaded_with_count(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(app_name="My App", image_count=15)

        result = format_snapshot_pr_comment(
            [artifact], {artifact.id: metrics}, {}, {}, {}, project=self.project
        )

        assert "## Sentry Snapshot Testing" in result
        assert "15 uploaded" in result
        assert "My App" in result
        assert "`com.example.app`" in result

    def test_no_base_uses_same_table_header(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics()

        result = format_snapshot_pr_comment(
            [artifact], {artifact.id: metrics}, {}, {}, {}, project=self.project
        )

        assert (
            "| Name | Added | Removed | Changed | Renamed | Unchanged | Skipped | Status |"
            in result
        )

    def test_no_base_multiple_artifacts(self) -> None:
        artifacts = []
        metrics_map: dict[int, PreprodSnapshotMetrics] = {}

        for i in range(2):
            artifact, metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.app{i}", build_number=i + 1, image_count=5 + i
            )
            artifacts.append(artifact)
            metrics_map[artifact.id] = metrics

        result = format_snapshot_pr_comment(
            artifacts, metrics_map, {}, {}, {}, project=self.project
        )

        assert "com.example.app0" in result
        assert "com.example.app1" in result
        assert "5 uploaded" in result
        assert "6 uploaded" in result

    def test_no_base_app_id_shown(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(app_id="com.example.myapp")

        result = format_snapshot_pr_comment(
            [artifact], {artifact.id: metrics}, {}, {}, {}, project=self.project
        )

        assert "`com.example.myapp`" in result


@cell_silo_test
class FormatSoloPrCommentTest(SnapshotPrCommentTestBase):
    def test_solo_shows_uploaded_count_and_first_upload_message(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(app_name="My App", image_count=7)

        result = format_solo_snapshot_pr_comment(
            [artifact], {artifact.id: metrics}, project=self.project
        )

        assert "## Sentry Snapshot Testing" in result
        assert "7 uploaded" in result
        assert "My App" in result
        assert "Snapshot diffs will appear when we have a base upload to compare against" in result
        assert "main branch" in result
        assert f"/settings/projects/{self.project.slug}/mobile-builds/" in result
        assert "tab=snapshots" in result
        assert f"{self.project.name} Snapshot Settings" in result

    def test_solo_empty_artifacts_raises(self) -> None:
        with pytest.raises(ValueError, match="Cannot format PR comment for empty artifact list"):
            format_solo_snapshot_pr_comment([], {}, project=self.project)

    def test_solo_multiple_artifacts(self) -> None:
        artifact1, metrics1 = self._create_artifact_with_metrics(
            app_id="com.example.app1", build_number=1, image_count=3
        )
        artifact2, metrics2 = self._create_artifact_with_metrics(
            app_id="com.example.app2", build_number=2, image_count=5
        )

        result = format_solo_snapshot_pr_comment(
            [artifact1, artifact2],
            {artifact1.id: metrics1, artifact2.id: metrics2},
            project=self.project,
        )

        assert "com.example.app1" in result
        assert "com.example.app2" in result
        assert "3 uploaded" in result
        assert "5 uploaded" in result

    def test_waiting_for_base_shows_waiting_message(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(image_count=4)

        result = format_waiting_for_base_snapshot_pr_comment(
            [artifact], {artifact.id: metrics}, project=self.project
        )

        assert "## Sentry Snapshot Testing" in result
        assert "4 uploaded" in result
        assert "Waiting for base snapshots to finish uploading" in result
        assert "~10 minutes" in result
        assert f"/settings/projects/{self.project.slug}/mobile-builds/" in result

    def test_waiting_for_base_empty_artifacts_raises(self) -> None:
        with pytest.raises(ValueError, match="Cannot format PR comment for empty artifact list"):
            format_waiting_for_base_snapshot_pr_comment([], {}, project=self.project)

    def test_missing_base_shows_failure_message(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(image_count=2)

        result = format_missing_base_snapshot_pr_comment(
            [artifact], {artifact.id: metrics}, project=self.project
        )

        assert "## Sentry Snapshot Testing" in result
        assert "2 uploaded" in result
        assert "No base snapshots found to compare against" in result
        assert "main branch" in result
        assert f"/settings/projects/{self.project.slug}/mobile-builds/" in result

    def test_missing_base_empty_artifacts_raises(self) -> None:
        with pytest.raises(ValueError, match="Cannot format PR comment for empty artifact list"):
            format_missing_base_snapshot_pr_comment([], {}, project=self.project)
