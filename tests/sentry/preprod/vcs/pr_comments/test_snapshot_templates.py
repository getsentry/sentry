from __future__ import annotations

import pytest

from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.vcs.pr_comments.snapshot_templates import (
    format_snapshot_pr_comment,
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
            format_snapshot_pr_comment([], {}, {}, {}, {})


@cell_silo_test
class FormatSnapshotPrCommentProcessingTest(SnapshotPrCommentTestBase):
    def test_no_metrics_shows_processing(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
        )

        result = format_snapshot_pr_comment([artifact], {}, {}, {}, {})

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
        )

        assert "## Sentry Snapshot Testing" in result
        assert "Unchanged" in result
        assert "My App" in result
        assert "`com.example.app`" in result
        # Zero counts are plain text, non-zero unchanged is linked
        assert "| 0 | 0 | 0 | 0 |" in result
        assert "?section=unchanged" in result

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
        )

        assert "Needs approval" in result
        assert "?section=added" in result
        assert "?section=removed" in result
        assert "?section=changed" in result
        assert "?section=renamed" in result

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
        )

        assert f"/preprod/snapshots/{head_artifact.id}" in result
        assert "?section=changed" in result

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
        )

        assert "?section=" not in result

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
        )

        assert "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |" in result


@cell_silo_test
class FormatSnapshotPrCommentNoBaseTest(SnapshotPrCommentTestBase):
    def test_no_base_shows_uploaded_with_count(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(app_name="My App", image_count=15)

        result = format_snapshot_pr_comment([artifact], {artifact.id: metrics}, {}, {}, {})

        assert "## Sentry Snapshot Testing" in result
        assert "15 uploaded" in result
        assert "My App" in result
        assert "`com.example.app`" in result

    def test_no_base_uses_same_table_header(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics()

        result = format_snapshot_pr_comment([artifact], {artifact.id: metrics}, {}, {}, {})

        assert "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |" in result

    def test_no_base_multiple_artifacts(self) -> None:
        artifacts = []
        metrics_map: dict[int, PreprodSnapshotMetrics] = {}

        for i in range(2):
            artifact, metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.app{i}", build_number=i + 1, image_count=5 + i
            )
            artifacts.append(artifact)
            metrics_map[artifact.id] = metrics

        result = format_snapshot_pr_comment(artifacts, metrics_map, {}, {}, {})

        assert "com.example.app0" in result
        assert "com.example.app1" in result
        assert "5 uploaded" in result
        assert "6 uploaded" in result

    def test_no_base_app_id_shown(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(app_id="com.example.myapp")

        result = format_snapshot_pr_comment([artifact], {artifact.id: metrics}, {}, {}, {})

        assert "`com.example.myapp`" in result
