from datetime import timedelta

from django.utils import timezone

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.artifact_search import (
    artifact_matches_query,
    get_sequential_base_artifact,
    queryset_for_query,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
    PreprodComparisonApproval,
    PreprodSnapshotMetrics,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison
from sentry.testutils.cases import TestCase


class GetSequentialBaseArtifactTest(TestCase):
    def _create_artifact_with_metrics(
        self,
        app_id="com.example.app",
        artifact_type=PreprodArtifact.ArtifactType.APK,
        build_configuration=None,
        date_added=None,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        app_name=None,
        **kwargs,
    ):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id=app_id,
            artifact_type=artifact_type,
            build_configuration=build_configuration,
            date_added=date_added,
            app_name=app_name,
            **kwargs,
        )
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=1000,
            max_download_size=500,
            state=state,
        )
        return artifact

    def test_returns_most_recent_matching_artifact(self) -> None:
        now = timezone.now()
        oldest = self._create_artifact_with_metrics(date_added=now - timedelta(hours=3))
        middle = self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is not None
        assert result.id == middle.id
        assert result.id != oldest.id

    def test_returns_none_when_no_prior_artifact(self) -> None:
        head = self._create_artifact_with_metrics()

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_excludes_self(self) -> None:
        head = self._create_artifact_with_metrics()

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_requires_completed_size_metrics(self) -> None:
        self._create_artifact_with_metrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_matches_on_app_id(self) -> None:
        self._create_artifact_with_metrics(
            app_id="com.other.app",
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            app_id="com.example.app",
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_matches_on_artifact_type(self) -> None:
        self._create_artifact_with_metrics(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            artifact_type=PreprodArtifact.ArtifactType.APK,
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_matches_on_build_configuration(self) -> None:
        config_release = self.create_preprod_build_configuration(
            project=self.project, name="release"
        )
        config_debug = self.create_preprod_build_configuration(project=self.project, name="debug")

        self._create_artifact_with_metrics(
            build_configuration=config_debug,
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            build_configuration=config_release,
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_applies_query_filter(self) -> None:
        now = timezone.now()
        # This one matches the query
        matching = self._create_artifact_with_metrics(
            app_name="MyApp",
            date_added=now - timedelta(hours=3),
        )
        # This one does not match the query
        self._create_artifact_with_metrics(
            app_name="OtherApp",
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            app_name="MyApp",
            date_added=now - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "app_name:MyApp", self.organization)
        assert result is not None
        assert result.id == matching.id

    def test_applies_query_filter_on_annotated_field(self) -> None:
        now = timezone.now()
        base = self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        result = get_sequential_base_artifact(head, "install_size:>500", self.organization)
        assert result is not None
        assert result.id == base.id

    def test_empty_query_matches_all(self) -> None:
        now = timezone.now()
        base = self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is not None
        assert result.id == base.id

    def test_handles_null_build_configuration(self) -> None:
        now = timezone.now()
        base = self._create_artifact_with_metrics(
            build_configuration=None,
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            build_configuration=None,
            date_added=now - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is not None
        assert result.id == base.id


class ArtifactMatchesQuerySnapshotFiltersTest(TestCase):
    def _create_snapshot_comparison(
        self,
        head_image_count: int = 0,
        base_image_count: int = 0,
        **comparison_fields: int,
    ) -> PreprodArtifact:
        head_artifact = self.create_preprod_artifact(project=self.project)
        head_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=head_artifact, image_count=head_image_count
        )
        self._add_comparison(head_metrics, base_image_count=base_image_count, **comparison_fields)
        return head_artifact

    def _add_comparison(
        self,
        head_metrics: PreprodSnapshotMetrics,
        base_image_count: int = 0,
        **comparison_fields: int,
    ) -> None:
        base_artifact = self.create_preprod_artifact(project=self.project)
        base_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=base_artifact, image_count=base_image_count
        )
        self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            **comparison_fields,
        )

    def test_image_count_operators(self) -> None:
        artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_snapshot_metrics(preprod_artifact=artifact, image_count=10)

        assert artifact_matches_query(artifact, "image_count:>5", self.organization)
        assert not artifact_matches_query(artifact, "image_count:>15", self.organization)
        assert artifact_matches_query(artifact, "image_count:10", self.organization)
        assert not artifact_matches_query(artifact, "image_count:11", self.organization)

    def test_images_changed_operators(self) -> None:
        artifact = self._create_snapshot_comparison(images_changed=10)

        assert artifact_matches_query(artifact, "images_changed:>5", self.organization)
        assert not artifact_matches_query(artifact, "images_changed:>15", self.organization)
        assert artifact_matches_query(artifact, "images_changed:10", self.organization)
        assert not artifact_matches_query(artifact, "images_changed:11", self.organization)
        assert artifact_matches_query(artifact, "images_changed:<=10", self.organization)
        assert not artifact_matches_query(artifact, "images_changed:<=9", self.organization)
        assert artifact_matches_query(artifact, "images_changed:>=10", self.organization)
        assert not artifact_matches_query(artifact, "images_changed:>=11", self.organization)

    def test_image_comparison_fields_all_wired(self) -> None:
        artifact = self._create_snapshot_comparison(
            images_added=1,
            images_removed=2,
            images_unchanged=4,
            images_renamed=5,
            images_skipped=6,
        )
        assert artifact_matches_query(artifact, "images_added:1", self.organization)
        assert artifact_matches_query(artifact, "images_removed:2", self.organization)
        assert artifact_matches_query(artifact, "images_unchanged:4", self.organization)
        assert artifact_matches_query(artifact, "images_renamed:5", self.organization)
        assert artifact_matches_query(artifact, "images_skipped:6", self.organization)

    def test_multiple_comparisons_no_duplicates(self) -> None:
        """A head artifact with two matching comparisons should appear exactly once."""
        head_artifact = self.create_preprod_artifact(project=self.project)
        head_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=head_artifact, image_count=20
        )
        for _ in range(2):
            self._add_comparison(head_metrics, base_image_count=20, images_changed=10)

        queryset = queryset_for_query("images_changed:>5", self.organization)
        assert queryset.filter(pk=head_artifact.pk).count() == 1

    def test_images_changed_not_equal(self) -> None:
        head_artifact = self.create_preprod_artifact(project=self.project)
        head_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=head_artifact, image_count=20
        )
        self._add_comparison(head_metrics, base_image_count=20, images_changed=5)

        assert artifact_matches_query(head_artifact, "images_changed:!=3", self.organization)
        assert not artifact_matches_query(head_artifact, "images_changed:!=5", self.organization)

    def test_images_changed_not_equal_no_comparison_row(self) -> None:
        no_metrics = self.create_preprod_artifact(project=self.project)
        no_comparison = self.create_preprod_artifact(project=self.project)
        self.create_preprod_snapshot_metrics(preprod_artifact=no_comparison, image_count=0)

        assert artifact_matches_query(no_metrics, "images_changed:!=3", self.organization)
        assert artifact_matches_query(no_comparison, "images_changed:!=3", self.organization)


class ArtifactMatchesQueryIsApprovedFilterTest(TestCase):
    def _create_artifact_with_approval(
        self,
        feature_type: int = PreprodComparisonApproval.FeatureType.SNAPSHOTS,
        status: int = PreprodComparisonApproval.ApprovalStatus.APPROVED,
        with_approval_row: bool = True,
    ) -> PreprodArtifact:
        artifact = self.create_preprod_artifact(project=self.project)
        if with_approval_row:
            self.create_preprod_comparison_approval(
                preprod_artifact=artifact,
                preprod_feature_type=feature_type,
                approval_status=status,
            )
        return artifact

    def test_is_approved_by_status(self) -> None:
        approved = self._create_artifact_with_approval()
        pending = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL
        )
        rejected = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.REJECTED
        )
        no_row = self._create_artifact_with_approval(with_approval_row=False)

        assert artifact_matches_query(approved, "is_approved:true", self.organization)
        assert not artifact_matches_query(pending, "is_approved:true", self.organization)
        assert not artifact_matches_query(rejected, "is_approved:true", self.organization)
        assert not artifact_matches_query(no_row, "is_approved:true", self.organization)

        assert not artifact_matches_query(approved, "is_approved:false", self.organization)
        assert artifact_matches_query(pending, "is_approved:false", self.organization)
        assert artifact_matches_query(rejected, "is_approved:false", self.organization)
        assert artifact_matches_query(no_row, "is_approved:false", self.organization)

    def test_is_approved_scoped_to_snapshots_feature_type(self) -> None:
        artifact = self._create_artifact_with_approval(
            feature_type=PreprodComparisonApproval.FeatureType.SIZE,
        )

        assert not artifact_matches_query(artifact, "is_approved:true", self.organization)

    def test_is_approved_negation_operator(self) -> None:
        approved_artifact = self._create_artifact_with_approval()
        pending_artifact = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL
        )

        assert not artifact_matches_query(approved_artifact, "!is_approved:true", self.organization)
        assert artifact_matches_query(pending_artifact, "!is_approved:true", self.organization)


class ArtifactMatchesQuerySnapshotStatusFilterTest(TestCase):
    def _create_artifact_with_approval(
        self,
        feature_type: int = PreprodComparisonApproval.FeatureType.SNAPSHOTS,
        status: int = PreprodComparisonApproval.ApprovalStatus.APPROVED,
        with_approval_row: bool = True,
        extras: dict | None = None,
    ) -> PreprodArtifact:
        artifact = self.create_preprod_artifact(project=self.project)
        if with_approval_row:
            self.create_preprod_comparison_approval(
                preprod_artifact=artifact,
                preprod_feature_type=feature_type,
                approval_status=status,
                extras=extras,
            )
        return artifact

    def test_snapshot_status_approved_matches_manual_only(self) -> None:
        manual = self._create_artifact_with_approval()
        auto = self._create_artifact_with_approval(extras={"auto_approval": True})
        pending = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL
        )

        assert artifact_matches_query(manual, "snapshot_status:approved", self.organization)
        assert not artifact_matches_query(auto, "snapshot_status:approved", self.organization)
        assert not artifact_matches_query(pending, "snapshot_status:approved", self.organization)

    def test_snapshot_status_auto_approved(self) -> None:
        manual = self._create_artifact_with_approval()
        auto = self._create_artifact_with_approval(extras={"auto_approval": True})
        pending = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL
        )

        assert not artifact_matches_query(
            manual, "snapshot_status:auto_approved", self.organization
        )
        assert artifact_matches_query(auto, "snapshot_status:auto_approved", self.organization)
        assert not artifact_matches_query(
            pending, "snapshot_status:auto_approved", self.organization
        )

    def test_snapshot_status_requires_approval(self) -> None:
        manual = self._create_artifact_with_approval()
        pending = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL
        )

        assert not artifact_matches_query(
            manual, "snapshot_status:requires_approval", self.organization
        )
        assert artifact_matches_query(
            pending, "snapshot_status:requires_approval", self.organization
        )

    def test_snapshot_status_no_record_matches_nothing(self) -> None:
        no_row = self._create_artifact_with_approval(with_approval_row=False)

        assert not artifact_matches_query(no_row, "snapshot_status:approved", self.organization)
        assert not artifact_matches_query(
            no_row, "snapshot_status:auto_approved", self.organization
        )
        assert not artifact_matches_query(
            no_row, "snapshot_status:requires_approval", self.organization
        )

    def test_snapshot_status_scoped_to_snapshots(self) -> None:
        artifact = self._create_artifact_with_approval(
            feature_type=PreprodComparisonApproval.FeatureType.SIZE,
        )

        assert not artifact_matches_query(artifact, "snapshot_status:approved", self.organization)

    def test_snapshot_status_in_filter(self) -> None:
        manual = self._create_artifact_with_approval()
        auto = self._create_artifact_with_approval(extras={"auto_approval": True})
        pending = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL
        )

        assert artifact_matches_query(
            manual, "snapshot_status:[approved, auto_approved]", self.organization
        )
        assert artifact_matches_query(
            auto, "snapshot_status:[approved, auto_approved]", self.organization
        )
        assert not artifact_matches_query(
            pending, "snapshot_status:[approved, auto_approved]", self.organization
        )

    def test_snapshot_status_negation(self) -> None:
        manual = self._create_artifact_with_approval()
        auto = self._create_artifact_with_approval(extras={"auto_approval": True})
        pending = self._create_artifact_with_approval(
            status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL
        )

        assert not artifact_matches_query(manual, "!snapshot_status:approved", self.organization)
        assert artifact_matches_query(auto, "!snapshot_status:approved", self.organization)
        assert artifact_matches_query(pending, "!snapshot_status:approved", self.organization)

    def test_snapshot_status_invalid_value(self) -> None:
        import pytest

        from sentry.exceptions import InvalidSearchQuery

        artifact = self._create_artifact_with_approval()

        with pytest.raises(InvalidSearchQuery):
            artifact_matches_query(artifact, "snapshot_status:bogus", self.organization)

    def _create_artifact_with_comparison_state(
        self,
        state: int,
        commit_comparison: CommitComparison | None = None,
    ) -> PreprodArtifact:
        if commit_comparison is None:
            commit_comparison = self.create_commit_comparison(organization=self.organization)
        artifact = self.create_preprod_artifact(
            project=self.project, commit_comparison=commit_comparison
        )
        head_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=artifact, image_count=5
        )
        base_artifact = self.create_preprod_artifact(project=self.project)
        base_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=base_artifact, image_count=5
        )
        self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=state,
        )
        return artifact

    def test_snapshot_status_base(self) -> None:
        cc = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha=None,
            head_repo_name="owner/repo",
        )
        base_artifact = self.create_preprod_artifact(project=self.project, commit_comparison=cc)
        self.create_preprod_snapshot_metrics(preprod_artifact=base_artifact, image_count=5)

        no_cc_artifact = self.create_preprod_artifact(project=self.project)
        self.create_preprod_snapshot_metrics(preprod_artifact=no_cc_artifact, image_count=5)

        pr_cc = self.create_commit_comparison(organization=self.organization)
        pr_artifact = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.SUCCESS,
            commit_comparison=pr_cc,
        )

        assert artifact_matches_query(base_artifact, "snapshot_status:base", self.organization)
        assert artifact_matches_query(no_cc_artifact, "snapshot_status:base", self.organization)
        assert not artifact_matches_query(pr_artifact, "snapshot_status:base", self.organization)

    def test_snapshot_status_no_base(self) -> None:
        cc = self.create_commit_comparison(organization=self.organization)
        artifact = self.create_preprod_artifact(project=self.project, commit_comparison=cc)
        self.create_preprod_snapshot_metrics(preprod_artifact=artifact, image_count=5)

        base_cc = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha=None,
            head_repo_name="owner/repo",
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project, commit_comparison=base_cc
        )
        self.create_preprod_snapshot_metrics(preprod_artifact=base_artifact, image_count=5)

        assert artifact_matches_query(artifact, "snapshot_status:no_base", self.organization)
        assert not artifact_matches_query(
            base_artifact, "snapshot_status:no_base", self.organization
        )

    def test_snapshot_status_pending(self) -> None:
        pending = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.PENDING
        )
        success = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.SUCCESS
        )

        assert artifact_matches_query(pending, "snapshot_status:pending", self.organization)
        assert not artifact_matches_query(success, "snapshot_status:pending", self.organization)

    def test_snapshot_status_processing(self) -> None:
        processing = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.PROCESSING
        )
        success = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.SUCCESS
        )

        assert artifact_matches_query(processing, "snapshot_status:processing", self.organization)
        assert not artifact_matches_query(success, "snapshot_status:processing", self.organization)

    def test_snapshot_status_failed(self) -> None:
        failed = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.FAILED
        )
        success = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.SUCCESS
        )

        assert artifact_matches_query(failed, "snapshot_status:failed", self.organization)
        assert not artifact_matches_query(success, "snapshot_status:failed", self.organization)

    def test_snapshot_status_in_filter_mixed(self) -> None:
        pending = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.PENDING
        )
        failed = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.FAILED
        )
        success = self._create_artifact_with_comparison_state(
            state=PreprodSnapshotComparison.State.SUCCESS
        )

        assert artifact_matches_query(
            pending, "snapshot_status:[pending, failed]", self.organization
        )
        assert artifact_matches_query(
            failed, "snapshot_status:[pending, failed]", self.organization
        )
        assert not artifact_matches_query(
            success, "snapshot_status:[pending, failed]", self.organization
        )
