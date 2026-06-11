from __future__ import annotations

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.snapshots.utils import find_base_snapshot_artifact
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class FindBaseSnapshotArtifactTest(TestCase):
    def setUp(self):
        super().setUp()
        cc = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="o/r",
            base_repo_name="o/r",
            head_sha="base_head_sha",
            base_sha="grandparent_sha",
            provider="github",
        )
        self.artifact = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc
        )
        self.create_preprod_snapshot_metrics(self.artifact, is_selective=True)

    def _args(self):
        return dict(
            organization_id=self.organization.id,
            base_sha="base_head_sha",
            base_repo_name="o/r",
            project_id=self.project.id,
            app_id="com.x",
            artifact_type=self.artifact.artifact_type,
            build_configuration=None,
        )

    def test_selective_base_excluded_by_default(self):
        assert find_base_snapshot_artifact(**self._args()) is None

    def test_selective_base_allowed_when_opted_in(self):
        result = find_base_snapshot_artifact(**self._args(), allow_selective=True)
        assert result is not None
        assert result.preprodsnapshotmetrics.is_selective is True

    def test_non_selective_base_returned_with_allow_selective(self):
        cc = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="o/r",
            base_repo_name="o/r",
            head_sha="full_base_head_sha",
            base_sha="gp_sha",
            provider="github",
        )
        artifact = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc
        )
        self.create_preprod_snapshot_metrics(artifact, is_selective=False)
        args = dict(
            organization_id=self.organization.id,
            base_sha="full_base_head_sha",
            base_repo_name="o/r",
            project_id=self.project.id,
            app_id="com.x",
            artifact_type=artifact.artifact_type,
            build_configuration=None,
        )
        # A normal full base must be returned regardless of allow_selective.
        assert find_base_snapshot_artifact(**args) is not None
        assert find_base_snapshot_artifact(**args, allow_selective=True) is not None
