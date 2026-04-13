from __future__ import annotations

import pytest

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.vcs.status_checks.snapshots.templates import (
    format_first_snapshot_status_check_messages,
    format_generated_snapshot_status_check_messages,
    format_missing_base_snapshot_status_check_messages,
    format_snapshot_status_check_messages,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


class SnapshotStatusCheckTestBase(TestCase):
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
        state: int = PreprodArtifact.ArtifactState.PROCESSED,
        commit_comparison: CommitComparison | None = None,
    ) -> tuple[PreprodArtifact, PreprodSnapshotMetrics]:
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=state,
            app_id=app_id,
            app_name=app_name,
            build_version=build_version,
            build_number=build_number,
            commit_comparison=commit_comparison,
        )
        metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=image_count,
        )
        return artifact, metrics

    def _create_approval(self, artifact: PreprodArtifact) -> PreprodComparisonApproval:
        return PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )

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


@cell_silo_test
class SnapshotEmptyArtifactsTest(SnapshotStatusCheckTestBase):
    def test_empty_artifacts_raises_error(self) -> None:
        with pytest.raises(ValueError, match="Cannot format messages for empty artifact list"):
            format_snapshot_status_check_messages([], {}, {}, StatusCheckStatus.SUCCESS, {}, {})


@cell_silo_test
class SnapshotProcessingStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_artifact_without_metrics_shows_processing(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        title, subtitle, summary = format_snapshot_status_check_messages(
            [artifact], {}, {}, StatusCheckStatus.IN_PROGRESS, {}, {}
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Comparing snapshots..."
        assert "Processing" in summary
        assert "com.example.app" in summary

    def test_artifact_with_metrics_but_no_comparison_shows_processing(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics()

        snapshot_metrics_map = {artifact.id: metrics}

        title, subtitle, summary = format_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map, {}, StatusCheckStatus.IN_PROGRESS, {}, {}
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Comparing snapshots..."
        assert "Processing" in summary

    def test_comparison_in_pending_state_shows_comparing(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(app_id="com.example.head")
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, state=PreprodSnapshotComparison.State.PENDING
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.IN_PROGRESS,
            {},
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Comparing snapshots..."
        assert "Processing" in summary

    def test_comparison_in_processing_state_shows_comparing(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(app_id="com.example.head")
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, state=PreprodSnapshotComparison.State.PROCESSING
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, subtitle, _ = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.IN_PROGRESS,
            {},
            {},
        )

        assert subtitle == "Comparing snapshots..."


@cell_silo_test
class SnapshotSuccessStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_all_images_match_shows_success(self) -> None:
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

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No changes detected"
        assert "✅ Unchanged" in summary
        assert "My App" in summary

    def test_app_id_shown_in_name_cell(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(
            app_id="com.example.noname"
        )
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(head_metrics, base_metrics)

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            {},
        )

        assert "`com.example.noname`" in summary

    def test_multiple_artifacts_all_match(self) -> None:
        artifacts = []
        snapshot_metrics_map = {}
        comparisons_map = {}

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

        title, subtitle, summary = format_snapshot_status_check_messages(
            artifacts,
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No changes detected"
        for i in range(3):
            assert f"com.example.app{i}" in summary


@cell_silo_test
class SnapshotChangesFormattingTest(SnapshotStatusCheckTestBase):
    def test_images_changed_shows_failure_subtitle(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=3,
            images_added=0,
            images_removed=0,
            images_unchanged=7,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {head_artifact.id: True},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "3 modified, 7 unchanged"
        assert "⏳ Needs approval" in summary

    def test_single_image_changed(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=1,
            images_unchanged=9,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, subtitle, _ = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {head_artifact.id: True},
        )

        assert subtitle == "1 modified, 9 unchanged"

    def test_images_added_and_removed(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=0,
            images_added=2,
            images_removed=1,
            images_unchanged=8,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, subtitle, _ = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {},
        )

        assert subtitle == "2 added, 1 removed, 8 unchanged"

    def test_images_renamed(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_renamed=4,
            images_unchanged=6,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, subtitle, _ = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {head_artifact.id: True},
        )

        assert subtitle == "4 renamed, 6 unchanged"

    def test_all_change_types_combined(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=3,
            images_added=1,
            images_removed=2,
            images_renamed=1,
            images_unchanged=5,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {head_artifact.id: True},
        )

        assert subtitle == "3 modified, 1 added, 2 removed, 1 renamed, 5 unchanged"
        assert "⏳ Needs approval" in summary


@cell_silo_test
class SnapshotFailureStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_failed_comparison_returns_error_message(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            state=PreprodSnapshotComparison.State.FAILED,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "We had trouble comparing snapshots, our team is investigating."
        assert summary == ""

    def test_failed_comparison_early_returns_ignoring_other_artifacts(self) -> None:
        # First artifact has a failed comparison
        head1, head1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.failed", build_number=1
        )
        base1, base1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base1", build_number=10
        )
        comparison1 = self._create_comparison(
            head1_metrics, base1_metrics, state=PreprodSnapshotComparison.State.FAILED
        )

        # Second artifact has changes
        head2, head2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.changed", build_number=2
        )
        base2, base2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base2", build_number=11
        )
        comparison2 = self._create_comparison(
            head2_metrics, base2_metrics, images_changed=5, images_unchanged=5
        )

        snapshot_metrics_map = {
            head1.id: head1_metrics,
            head2.id: head2_metrics,
        }
        comparisons_map = {
            head1_metrics.id: comparison1,
            head2_metrics.id: comparison2,
        }

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head1, head2],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {},
        )

        assert subtitle == "We had trouble comparing snapshots, our team is investigating."
        assert summary == ""


@cell_silo_test
class SnapshotMixedStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_mixed_success_and_processing(self) -> None:
        head1, head1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.done", build_number=1
        )
        base1, base1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base1", build_number=10
        )
        comparison1 = self._create_comparison(head1_metrics, base1_metrics, images_unchanged=5)

        # Processing comparison
        head2, head2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.pending", build_number=2
        )
        base2, base2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base2", build_number=11
        )
        comparison2 = self._create_comparison(
            head2_metrics, base2_metrics, state=PreprodSnapshotComparison.State.PROCESSING
        )

        snapshot_metrics_map = {
            head1.id: head1_metrics,
            head2.id: head2_metrics,
        }
        comparisons_map = {
            head1_metrics.id: comparison1,
            head2_metrics.id: comparison2,
        }

        _, subtitle, summary = format_snapshot_status_check_messages(
            [head1, head2],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.IN_PROGRESS,
            {},
            {},
        )

        assert subtitle == "Comparing snapshots..."
        assert "✅ Unchanged" in summary
        assert "Processing" in summary


@cell_silo_test
class SnapshotSummaryFormattingTest(SnapshotStatusCheckTestBase):
    def test_summary_table_has_correct_headers(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")
        comparison = self._create_comparison(head_metrics, base_metrics)

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            {},
        )

        assert "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |" in summary
        assert "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |" in summary

    def test_summary_has_no_settings_link(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")
        comparison = self._create_comparison(head_metrics, base_metrics)

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            {},
        )

        assert "Configure" not in summary
        assert "settings" not in summary

    def test_summary_uses_comparison_url_when_base_artifact_exists(self) -> None:
        head_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="head_sha_123",
            base_sha="base_sha_456",
            provider="github",
            organization_id=self.organization.id,
        )

        head_artifact, head_metrics = self._create_artifact_with_metrics(
            commit_comparison=head_commit_comparison,
        )
        base_artifact, base_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base",
        )
        comparison = self._create_comparison(head_metrics, base_metrics)

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}
        base_artifact_map = {head_artifact.id: base_artifact}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            base_artifact_map,
            {},
        )

        expected_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"
        assert expected_url in summary

    def test_summary_uses_artifact_url_when_no_base(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")
        comparison = self._create_comparison(head_metrics, base_metrics)

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            {},
        )

        expected_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"
        assert expected_url in summary

    def test_full_success_summary_format(self) -> None:
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
            images_renamed=0,
            images_unchanged=15,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No changes detected"

        expected = (
            "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |\n"
            "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
            f"| [My App]({artifact_url})<br>`com.example.app`"
            f" | 0 | 0 | 0 | 0"
            f" | [{15}]({artifact_url}?section=unchanged)"
            f" | ✅ Unchanged |"
        )
        assert summary == expected

    def test_full_failure_summary_format(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App"
        )
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")
        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=3,
            images_added=1,
            images_removed=2,
            images_renamed=1,
            images_unchanged=4,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            {head_artifact.id: True},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "3 modified, 1 added, 2 removed, 1 renamed, 4 unchanged"

        expected = (
            "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |\n"
            "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
            f"| [My App]({artifact_url})<br>`com.example.app`"
            f" | [{1}]({artifact_url}?section=added)"
            f" | [{2}]({artifact_url}?section=removed)"
            f" | [{3}]({artifact_url}?section=changed)"
            f" | [{1}]({artifact_url}?section=renamed)"
            f" | [{4}]({artifact_url}?section=unchanged)"
            f" | ⏳ Needs approval |"
        )
        assert summary == expected


@cell_silo_test
class SnapshotFirstUploadFormattingTest(SnapshotStatusCheckTestBase):
    def test_first_upload_single_artifact(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App", image_count=24
        )
        snapshot_metrics_map = {artifact.id: metrics}

        title, subtitle, summary = format_first_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map
        )

        assert title == "Snapshot Testing"
        assert subtitle == "24 snapshots uploaded"
        assert "My App" in summary
        assert "24" in summary
        assert "✅ Uploaded" in summary
        assert "first snapshot upload" in summary

    def test_first_upload_multiple_artifacts(self) -> None:
        artifacts = []
        snapshot_metrics_map: dict[int, PreprodSnapshotMetrics] = {}

        for i in range(3):
            artifact, metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.app{i}",
                build_number=i + 1,
                image_count=10,
            )
            artifacts.append(artifact)
            snapshot_metrics_map[artifact.id] = metrics

        title, subtitle, summary = format_first_snapshot_status_check_messages(
            artifacts, snapshot_metrics_map
        )

        assert title == "Snapshot Testing"
        assert subtitle == "30 snapshots uploaded"
        for i in range(3):
            assert f"com.example.app{i}" in summary
        assert "first snapshot upload" in summary

    def test_first_upload_artifact_without_metrics(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        title, subtitle, summary = format_first_snapshot_status_check_messages([artifact], {})

        assert title == "Snapshot Testing"
        assert subtitle == "0 snapshots uploaded"
        assert "⏳ Processing" in summary
        assert "com.example.app" in summary
        assert "first snapshot upload" in summary

    def test_first_upload_empty_artifacts_raises(self) -> None:
        with pytest.raises(ValueError, match="Cannot format messages for empty artifact list"):
            format_first_snapshot_status_check_messages([], {})

    def test_first_upload_summary_table_format(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App", image_count=15
        )
        snapshot_metrics_map = {artifact.id: metrics}

        _, _, summary = format_first_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map
        )

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{artifact.id}"

        expected = (
            "| Name | Snapshots | Status |\n"
            "| :--- | :---: | :---: |\n"
            f"| [My App]({artifact_url})<br>`com.example.app` | 15 | ✅ Uploaded |"
            "\n\nThis looks like your first snapshot upload. Snapshot diffs will appear when we have a base upload to compare against. Make sure to upload snapshots from your main branch."
        )
        assert summary == expected


@cell_silo_test
class SnapshotGeneratedFormattingTest(SnapshotStatusCheckTestBase):
    def test_generated_single_artifact(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App", image_count=24
        )
        snapshot_metrics_map = {artifact.id: metrics}

        title, subtitle, summary = format_generated_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Generated 24 snapshots"
        assert "My App" in summary
        assert "24" in summary
        assert "✅ Uploaded" in summary

    def test_generated_multiple_artifacts(self) -> None:
        artifacts = []
        snapshot_metrics_map: dict[int, PreprodSnapshotMetrics] = {}

        for i in range(3):
            artifact, metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.app{i}",
                build_number=i + 1,
                image_count=10,
            )
            artifacts.append(artifact)
            snapshot_metrics_map[artifact.id] = metrics

        title, subtitle, summary = format_generated_snapshot_status_check_messages(
            artifacts, snapshot_metrics_map
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Generated 30 snapshots"
        for i in range(3):
            assert f"com.example.app{i}" in summary

    def test_generated_single_snapshot_singular(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", image_count=1
        )
        snapshot_metrics_map = {artifact.id: metrics}

        _, subtitle, _ = format_generated_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map
        )

        assert subtitle == "Generated 1 snapshot"

    def test_generated_empty_artifacts_raises(self) -> None:
        with pytest.raises(ValueError, match="Cannot format messages for empty artifact list"):
            format_generated_snapshot_status_check_messages([], {})

    def test_generated_summary_table_format(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App", image_count=15
        )
        snapshot_metrics_map = {artifact.id: metrics}

        _, _, summary = format_generated_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map
        )

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{artifact.id}"

        expected = (
            "| Name | Snapshots | Status |\n"
            "| :--- | :---: | :---: |\n"
            f"| [My App]({artifact_url})<br>`com.example.app` | 15 | ✅ Uploaded |"
        )
        assert summary == expected


@cell_silo_test
class SnapshotMissingBaseFormattingTest(SnapshotStatusCheckTestBase):
    def test_missing_base_single_artifact(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App", image_count=24
        )
        snapshot_metrics_map = {artifact.id: metrics}

        title, subtitle, summary = format_missing_base_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No base snapshots found"
        assert "My App" in summary
        assert "24" in summary
        assert "✅ Uploaded" in summary
        assert "No base snapshots found to compare against" in summary

    def test_missing_base_multiple_artifacts(self) -> None:
        artifacts = []
        snapshot_metrics_map: dict[int, PreprodSnapshotMetrics] = {}

        for i in range(3):
            artifact, metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.app{i}",
                build_number=i + 1,
                image_count=10,
            )
            artifacts.append(artifact)
            snapshot_metrics_map[artifact.id] = metrics

        title, subtitle, summary = format_missing_base_snapshot_status_check_messages(
            artifacts, snapshot_metrics_map
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No base snapshots found"
        for i in range(3):
            assert f"com.example.app{i}" in summary
        assert "No base snapshots found to compare against" in summary

    def test_missing_base_empty_artifacts_raises(self) -> None:
        with pytest.raises(ValueError, match="Cannot format messages for empty artifact list"):
            format_missing_base_snapshot_status_check_messages([], {})

    def test_missing_base_summary_table_format(self) -> None:
        artifact, metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App", image_count=15
        )
        snapshot_metrics_map = {artifact.id: metrics}

        _, _, summary = format_missing_base_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map
        )

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{artifact.id}"

        expected = (
            "| Name | Snapshots | Status |\n"
            "| :--- | :---: | :---: |\n"
            f"| [My App]({artifact_url})<br>`com.example.app` | 15 | ✅ Uploaded |"
            "\n\nNo base snapshots found to compare against. Make sure snapshots are uploaded from your main branch."
        )
        assert summary == expected


@cell_silo_test
class SnapshotApprovalFormattingTest(SnapshotStatusCheckTestBase):
    def test_approved_artifact_shows_approved_status(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, images_changed=3, images_unchanged=7
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}
        changes_map = {head_artifact.id: True}
        approvals_map = {head_artifact.id: self._create_approval(head_artifact)}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            changes_map,
            approvals_map=approvals_map,
        )

        assert "✅ Approved" in summary
        assert "⏳ Needs approval" not in summary

    def test_unapproved_artifact_shows_needs_approval(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, images_changed=3, images_unchanged=7
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}
        changes_map = {head_artifact.id: True}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            changes_map,
            approvals_map=None,
        )

        assert "⏳ Needs approval" in summary
        assert "✅ Approved" not in summary

    def test_no_changes_shows_unchanged_regardless_of_approvals(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(head_metrics, base_metrics, images_unchanged=10)

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}
        changes_map = {head_artifact.id: False}
        approvals_map = {head_artifact.id: self._create_approval(head_artifact)}

        _, _, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            changes_map,
            approvals_map=approvals_map,
        )

        assert "✅ Unchanged" in summary
        assert "✅ Approved" not in summary

    def test_approved_summary_table_format(self) -> None:
        head_artifact, head_metrics = self._create_artifact_with_metrics(
            app_id="com.example.app", app_name="My App"
        )
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")
        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=3,
            images_added=1,
            images_removed=2,
            images_renamed=1,
            images_unchanged=4,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}
        changes_map = {head_artifact.id: True}
        approvals_map = {head_artifact.id: self._create_approval(head_artifact)}

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            {},
            changes_map,
            approvals_map=approvals_map,
        )

        assert title == "Snapshot Testing"
        assert subtitle == "3 modified, 1 added, 2 removed, 1 renamed, 4 unchanged"

        expected = (
            "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |\n"
            "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
            f"| [My App]({artifact_url})<br>`com.example.app`"
            f" | [{1}]({artifact_url}?section=added)"
            f" | [{2}]({artifact_url}?section=removed)"
            f" | [{3}]({artifact_url}?section=changed)"
            f" | [{1}]({artifact_url}?section=renamed)"
            f" | [{4}]({artifact_url}?section=unchanged)"
            f" | ✅ Approved |"
        )
        assert summary == expected

    def test_mixed_approved_and_unapproved_artifacts(self) -> None:
        head1, head1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.approved", build_number=1
        )
        base1, base1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base1", build_number=10
        )
        comparison1 = self._create_comparison(head1_metrics, base1_metrics, images_changed=2)

        head2, head2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.unapproved", build_number=2
        )
        base2, base2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base2", build_number=11
        )
        comparison2 = self._create_comparison(head2_metrics, base2_metrics, images_changed=1)

        snapshot_metrics_map = {head1.id: head1_metrics, head2.id: head2_metrics}
        comparisons_map = {head1_metrics.id: comparison1, head2_metrics.id: comparison2}
        changes_map = {head1.id: True, head2.id: True}
        approvals_map = {head1.id: self._create_approval(head1)}  # only head1 approved

        _, _, summary = format_snapshot_status_check_messages(
            [head1, head2],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            {},
            changes_map,
            approvals_map=approvals_map,
        )

        assert "✅ Approved" in summary
        assert "⏳ Needs approval" in summary
