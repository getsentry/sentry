from __future__ import annotations

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class PreprodArtifactModelTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )

    def test_get_sibling_artifacts_for_commit_single_artifact(self):
        """Test getting artifacts when there's only one artifact for the commit."""
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=commit_comparison,
        )

        artifacts = list(artifact.get_sibling_artifacts_for_commit())

        assert len(artifacts) == 1
        assert artifacts[0] == artifact

    def test_get_sibling_artifacts_for_commit_multiple_artifacts_same_commit(self):
        """Test getting artifacts when multiple artifacts exist for the same commit (monorepo)."""
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        artifacts = []
        app_ids = ["com.example.android", "com.example.ios", "com.example.web"]
        for app_id in app_ids:
            artifact = PreprodArtifact.objects.create(
                project=self.project,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                app_id=app_id,
                commit_comparison=commit_comparison,
            )
            artifacts.append(artifact)

        sibling_artifacts = list(artifacts[0].get_sibling_artifacts_for_commit())

        assert len(sibling_artifacts) == 3
        assert set(sibling_artifacts) == set(artifacts)

    def test_get_sibling_artifacts_for_commit_different_commits_excluded(self):
        """Test that artifacts from different commits are excluded."""
        commit_comparison_1 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test1",
            base_ref="main",
        )

        commit_comparison_2 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="c" * 40,
            base_sha="d" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test2",
            base_ref="main",
        )

        artifact_1 = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app1",
            commit_comparison=commit_comparison_1,
        )

        artifact_2 = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app2",
            commit_comparison=commit_comparison_2,
        )

        artifacts_1 = list(artifact_1.get_sibling_artifacts_for_commit())
        assert len(artifacts_1) == 1
        assert artifacts_1[0] == artifact_1

        artifacts_2 = list(artifact_2.get_sibling_artifacts_for_commit())
        assert len(artifacts_2) == 1
        assert artifacts_2[0] == artifact_2

    def test_get_sibling_artifacts_for_commit_cross_org_security(self):
        """Test that artifacts from different organizations are excluded for security."""
        # Create second organization
        other_org = self.create_organization(name="other_org")
        other_project = self.create_project(organization=other_org, name="other_project")

        # Create commit comparison for first org
        commit_comparison_org1 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create commit comparison for second org with same commit SHA
        commit_comparison_org2 = CommitComparison.objects.create(
            organization_id=other_org.id,
            head_sha="a" * 40,  # Same SHA as org1
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create artifacts in each org
        artifact_org1 = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app1",
            commit_comparison=commit_comparison_org1,
        )

        artifact_org2 = PreprodArtifact.objects.create(
            project=other_project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app2",
            commit_comparison=commit_comparison_org2,
        )

        # Query for org1 artifacts should only return org1 artifacts
        artifacts_org1 = list(artifact_org1.get_sibling_artifacts_for_commit())
        assert len(artifacts_org1) == 1
        assert artifacts_org1[0] == artifact_org1

        # Query for org2 artifacts should only return org2 artifacts
        artifacts_org2 = list(artifact_org2.get_sibling_artifacts_for_commit())
        assert len(artifacts_org2) == 1
        assert artifacts_org2[0] == artifact_org2

    def test_get_sibling_artifacts_for_commit_no_commit_comparison(self):
        """Test that method returns empty queryset when artifact has no commit_comparison."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=None,
        )

        artifacts = list(artifact.get_sibling_artifacts_for_commit())
        assert len(artifacts) == 0
