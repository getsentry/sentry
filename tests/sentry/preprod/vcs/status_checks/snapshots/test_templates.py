from __future__ import annotations

import pytest

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.vcs.status_checks.snapshots.templates import (
    format_snapshot_status_check_messages,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


class SnapshotStatusCheckTestBase(TestCase):
    def setUp(self):
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

    def _create_comparison(
        self,
        head_metrics: PreprodSnapshotMetrics,
        base_metrics: PreprodSnapshotMetrics,
        state: int = PreprodSnapshotComparison.State.SUCCESS,
        images_changed: int = 0,
        images_added: int = 0,
        images_removed: int = 0,
        images_unchanged: int = 10,
    ) -> PreprodSnapshotComparison:
        return PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=state,
            images_changed=images_changed,
            images_added=images_added,
            images_removed=images_removed,
            images_unchanged=images_unchanged,
        )


@region_silo_test
class SnapshotEmptyArtifactsTest(SnapshotStatusCheckTestBase):
    def test_empty_artifacts_raises_error(self):
        with pytest.raises(ValueError, match="Cannot format messages for empty artifact list"):
            format_snapshot_status_check_messages(
                [], {}, {}, StatusCheckStatus.SUCCESS, self.project, {}
            )


@region_silo_test
class SnapshotProcessingStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_artifact_without_metrics_shows_processing(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        title, subtitle, summary = format_snapshot_status_check_messages(
            [artifact], {}, {}, StatusCheckStatus.IN_PROGRESS, self.project, {}
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Comparing snapshots..."
        assert "Processing..." in summary
        assert "com.example.app" in summary

    def test_artifact_with_metrics_but_no_comparison_shows_processing(self):
        artifact, metrics = self._create_artifact_with_metrics()

        snapshot_metrics_map = {artifact.id: metrics}

        title, subtitle, summary = format_snapshot_status_check_messages(
            [artifact], snapshot_metrics_map, {}, StatusCheckStatus.IN_PROGRESS, self.project, {}
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Comparing snapshots..."
        assert "Processing..." in summary

    def test_comparison_in_pending_state_shows_comparing(self):
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
            self.project,
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "Comparing snapshots..."
        assert "Comparing" in summary

    def test_comparison_in_processing_state_shows_comparing(self):
        head_artifact, head_metrics = self._create_artifact_with_metrics(app_id="com.example.head")
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics, base_metrics, state=PreprodSnapshotComparison.State.PROCESSING
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.IN_PROGRESS,
            self.project,
            {},
        )

        assert subtitle == "Comparing snapshots..."


@region_silo_test
class SnapshotSuccessStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_all_images_match_shows_success(self):
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
            self.project,
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No changes detected"
        assert "✅" in summary
        assert "0 changed" in summary
        assert "10 unchanged" in summary
        assert "My App" in summary

    def test_app_id_used_when_no_app_name(self):
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
            self.project,
            {},
        )

        assert "com.example.noname" in summary

    def test_multiple_artifacts_all_match(self):
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
            self.project,
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No changes detected"
        for i in range(3):
            assert f"com.example.app{i}" in summary


@region_silo_test
class SnapshotChangesFormattingTest(SnapshotStatusCheckTestBase):
    def test_images_changed_shows_failure_subtitle(self):
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
            self.project,
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "3 images changed"
        assert "❌" in summary
        assert "3 changed" in summary
        assert "7 unchanged" in summary

    def test_single_image_changed_uses_singular(self):
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
            self.project,
            {},
        )

        assert subtitle == "1 image changed"

    def test_images_added_and_removed(self):
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

        _, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            self.project,
            {},
        )

        assert subtitle == "2 added, 1 removed"
        assert "2 added" in summary
        assert "1 removed" in summary

    def test_all_change_types_combined(self):
        head_artifact, head_metrics = self._create_artifact_with_metrics()
        base_artifact, base_metrics = self._create_artifact_with_metrics(app_id="com.example.base")

        comparison = self._create_comparison(
            head_metrics,
            base_metrics,
            images_changed=3,
            images_added=1,
            images_removed=2,
            images_unchanged=5,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        _, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            self.project,
            {},
        )

        assert subtitle == "3 images changed, 1 added, 2 removed"
        assert "❌" in summary
        assert "3 changed" in summary
        assert "1 added" in summary
        assert "2 removed" in summary
        assert "5 unchanged" in summary


@region_silo_test
class SnapshotFailureStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_failed_comparison_shows_failure(self):
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
            self.project,
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "1 comparison failed"
        assert "Failed" in summary

    def test_multiple_failed_comparisons(self):
        artifacts = []
        snapshot_metrics_map = {}
        comparisons_map = {}

        for i in range(2):
            head_artifact, head_metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.app{i}", build_number=i + 1
            )
            base_artifact, base_metrics = self._create_artifact_with_metrics(
                app_id=f"com.example.base{i}", build_number=i + 10
            )
            comparison = self._create_comparison(
                head_metrics,
                base_metrics,
                state=PreprodSnapshotComparison.State.FAILED,
            )

            artifacts.append(head_artifact)
            snapshot_metrics_map[head_artifact.id] = head_metrics
            comparisons_map[head_metrics.id] = comparison

        _, subtitle, _ = format_snapshot_status_check_messages(
            artifacts,
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            self.project,
            {},
        )

        assert subtitle == "2 comparisons failed"


@region_silo_test
class SnapshotMixedStateFormattingTest(SnapshotStatusCheckTestBase):
    def test_mixed_success_and_processing(self):
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
            self.project,
            {},
        )

        assert subtitle == "Comparing snapshots..."
        assert "✅" in summary
        assert "Comparing" in summary

    def test_mixed_changes_and_failures(self):
        # Comparison with changes
        head1, head1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.changed", build_number=1
        )
        base1, base1_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base1", build_number=10
        )
        comparison1 = self._create_comparison(
            head1_metrics, base1_metrics, images_changed=2, images_unchanged=8
        )

        # Failed comparison
        head2, head2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.failed", build_number=2
        )
        base2, base2_metrics = self._create_artifact_with_metrics(
            app_id="com.example.base2", build_number=11
        )
        comparison2 = self._create_comparison(
            head2_metrics, base2_metrics, state=PreprodSnapshotComparison.State.FAILED
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
            StatusCheckStatus.FAILURE,
            self.project,
            {},
        )

        # Has changes so subtitle should show changes, not failure count
        assert subtitle == "2 images changed"
        assert "❌" in summary
        assert "Failed" in summary


@region_silo_test
class SnapshotSummaryFormattingTest(SnapshotStatusCheckTestBase):
    def test_summary_table_has_correct_headers(self):
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
            self.project,
            {},
        )

        assert "| Name | Changed | Added | Removed | Unchanged |" in summary
        assert "|------|---------|-------|---------|-----------|\n" in summary

    def test_summary_contains_settings_link(self):
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
            self.project,
            {},
        )

        settings_url = f"http://testserver/settings/projects/{self.project.slug}/mobile-builds/"
        assert f"[Configure test_project snapshot settings]({settings_url})" in summary

    def test_summary_uses_comparison_url_when_base_artifact_exists(self):
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
            self.project,
            base_artifact_map,
        )

        # Should use comparison URL when base artifact exists
        expected_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/compare/{head_artifact.id}/{base_artifact.id}"
        assert expected_url in summary

    def test_summary_uses_artifact_url_when_no_base(self):
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
            self.project,
            {},
        )

        expected_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"
        assert expected_url in summary

    def test_full_success_summary_format(self):
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
            images_unchanged=15,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"
        settings_url = f"http://testserver/settings/projects/{self.project.slug}/mobile-builds/"

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.SUCCESS,
            self.project,
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "No changes detected"

        expected = (
            "| Name | Changed | Added | Removed | Unchanged |\n"
            "|------|---------|-------|---------|-----------|\n"
            f"| [My App]({artifact_url}) | ✅ 0 changed | 0 added | 0 removed | 15 unchanged |\n\n"
            f"[Configure test_project snapshot settings]({settings_url})"
        )
        assert summary == expected

    def test_full_failure_summary_format(self):
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
            images_unchanged=4,
        )

        snapshot_metrics_map = {head_artifact.id: head_metrics}
        comparisons_map = {head_metrics.id: comparison}

        artifact_url = f"http://testserver/organizations/{self.organization.slug}/preprod/snapshots/{head_artifact.id}"
        settings_url = f"http://testserver/settings/projects/{self.project.slug}/mobile-builds/"

        title, subtitle, summary = format_snapshot_status_check_messages(
            [head_artifact],
            snapshot_metrics_map,
            comparisons_map,
            StatusCheckStatus.FAILURE,
            self.project,
            {},
        )

        assert title == "Snapshot Testing"
        assert subtitle == "3 images changed, 1 added, 2 removed"

        expected = (
            "| Name | Changed | Added | Removed | Unchanged |\n"
            "|------|---------|-------|---------|-----------|\n"
            f"| [My App]({artifact_url}) | ❌ 3 changed | 1 added | 2 removed | 4 unchanged |\n\n"
            f"[Configure test_project snapshot settings]({settings_url})"
        )
        assert summary == expected
