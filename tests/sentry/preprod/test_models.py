from __future__ import annotations

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


class PreprodArtifactModelTestBase(TestCase):
    """Base test class with common setup for PreprodArtifact model tests."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )


@region_silo_test
class PreprodArtifactSiblingArtifactsTest(PreprodArtifactModelTestBase):
    """Tests for get_sibling_artifacts_for_commit method."""

    def test_get_sibling_artifacts_for_commit_single_artifact(self):
        """Test getting artifacts when there's only one artifact for the commit."""
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        artifact = self.create_preprod_artifact(
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
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
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
            artifact = self.create_preprod_artifact(
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
        commit_comparison_1 = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test1",
            base_ref="main",
        )

        commit_comparison_2 = self.create_commit_comparison(
            organization=self.organization,
            head_sha="c" * 40,
            base_sha="d" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test2",
            base_ref="main",
        )

        artifact_1 = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app1",
            commit_comparison=commit_comparison_1,
        )

        artifact_2 = self.create_preprod_artifact(
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
        commit_comparison_org1 = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create commit comparison for second org with same commit SHA
        commit_comparison_org2 = self.create_commit_comparison(
            organization=other_org,
            head_sha="a" * 40,  # Same SHA as org1
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create artifacts in each org
        artifact_org1 = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app1",
            commit_comparison=commit_comparison_org1,
        )

        artifact_org2 = self.create_preprod_artifact(
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
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=None,
        )

        artifacts = list(artifact.get_sibling_artifacts_for_commit())
        assert len(artifacts) == 0


@region_silo_test
class PreprodArtifactBaseArtifactTest(PreprodArtifactModelTestBase):
    """Tests for base artifact related methods."""

    def test_get_base_artifact_for_commit_single_artifact(self):
        """Test getting base artifact when there's only one base artifact."""
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=base_commit_comparison,
        )

        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,  # This matches the head_sha of base_commit_comparison
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create head artifact
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=head_commit_comparison,
        )

        # Get base artifact from head artifact
        result = head_artifact.get_base_artifact_for_commit().first()
        assert result == base_artifact

    def test_get_base_artifact_for_commit_multiple_artifacts_same_commit(self):
        """Test getting base artifact when multiple artifacts exist for the same base commit (monorepo)."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create multiple base artifacts (monorepo scenario)
        base_artifacts = []
        app_ids = ["com.example.android", "com.example.ios", "com.example.web"]
        for app_id in app_ids:
            artifact = self.create_preprod_artifact(
                project=self.project,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                app_id=app_id,
                commit_comparison=base_commit_comparison,
            )
            base_artifacts.append(artifact)

        # Create head artifact with matching app_id
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.android",  # This should match one of the base artifacts
            commit_comparison=head_commit_comparison,
        )

        # Get base artifact from head artifact (should return the one with matching app_id)
        result = head_artifact.get_base_artifact_for_commit().first()
        assert result is not None
        assert result.app_id == head_artifact.app_id
        assert result.app_id == "com.example.android"

    def test_get_base_artifact_for_commit_no_matching_app_id(self):
        """Test that method returns None when no base artifact has matching app_id."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifacts with different app_ids
        base_artifacts = []
        app_ids = ["com.example.android", "com.example.ios", "com.example.web"]
        for app_id in app_ids:
            artifact = self.create_preprod_artifact(
                project=self.project,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                app_id=app_id,
                commit_comparison=base_commit_comparison,
            )
            base_artifacts.append(artifact)

        # Create head artifact with app_id that doesn't match any base artifacts
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.different",  # This doesn't match any base artifacts
            commit_comparison=head_commit_comparison,
        )

        # Get base artifact from head artifact (should return None due to no matching app_id)
        result = head_artifact.get_base_artifact_for_commit().first()
        assert result is None

    def test_get_base_artifact_for_commit_no_base_commit(self):
        """Test that method returns None when no base commit comparison exists."""
        # Create head commit comparison with a base_sha that doesn't exist
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="x" * 40,  # Use a valid SHA format that doesn't exist
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create head artifact
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=head_commit_comparison,
        )

        # Get base artifact from head artifact (should return None)
        artifacts = list(head_artifact.get_base_artifact_for_commit())
        assert len(artifacts) == 0

    def test_get_base_artifact_for_commit_cross_org_security(self):
        """Test that base artifacts from different organizations are excluded for security."""
        # Create second organization
        other_org = self.create_organization(name="other_org")
        other_project = self.create_project(organization=other_org, name="other_project")

        # Create base commit comparison for first org
        base_commit_comparison_org1 = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create base commit comparison for second org with same head SHA
        base_commit_comparison_org2 = self.create_commit_comparison(
            organization=other_org,
            head_sha="b" * 40,  # Same SHA as org1
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison for first org
        head_commit_comparison_org1 = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        base_artifact_org1 = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=base_commit_comparison_org1,
        )

        base_artifact_org2 = self.create_preprod_artifact(
            project=other_project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",  # Same app_id but different org
            commit_comparison=base_commit_comparison_org2,
        )

        # Create head artifact in first org with matching app_id
        head_artifact_org1 = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",  # Matches base_artifact_org1
            commit_comparison=head_commit_comparison_org1,
        )

        # Query for base artifact from org1 should only return org1 base artifact
        result = head_artifact_org1.get_base_artifact_for_commit().first()
        assert result == base_artifact_org1
        assert result != base_artifact_org2

    def test_get_base_artifact_for_commit_no_commit_comparison(self):
        """Test that method returns None when artifact has no commit_comparison."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=None,
        )

        artifacts = list(artifact.get_base_artifact_for_commit())
        assert len(artifacts) == 0

    def test_get_base_artifact_multiple_commit_comparisons_uses_oldest(self):
        """Test that the oldest commit_comparison is used when more than one is found."""
        # Create multiple base commit comparisons with the same head_sha but different date_added
        # The older one (created first)
        base_commit_comparison_old = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create artifact for older comparison
        base_artifact_old = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=base_commit_comparison_old,
        )

        # The newer one (created second)
        base_commit_comparison_new = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="d" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="accidental/branch/upload",
            base_ref="develop",
        )

        # Create artifact for newer comparison
        self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=base_commit_comparison_new,
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create head artifact
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=head_commit_comparison,
        )

        # Multiple base commit comparisons exist; should use the oldest one
        result = head_artifact.get_base_artifact_for_commit().first()
        assert result == base_artifact_old

    def test_get_head_artifacts_for_commit_single_artifact(self):
        """Test getting head artifacts when there's only one head artifact."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison that references the base
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,  # This matches the head_sha of base_commit_comparison
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifact
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=base_commit_comparison,
        )

        # Create head artifact
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=head_commit_comparison,
        )

        # Get head artifacts from base artifact
        head_artifacts = list(base_artifact.get_head_artifacts_for_commit())
        assert len(head_artifacts) == 1
        assert head_artifacts[0] == head_artifact

    def test_get_head_artifacts_for_commit_multiple_artifacts_same_commit(self):
        """Test getting head artifacts when multiple head artifacts exist for the same base commit (monorepo)."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create multiple head commit comparisons that reference the same base
        head_commit_comparisons = []
        for i in range(3):
            head_commit_comparison = self.create_commit_comparison(
                organization=self.organization,
                head_sha=f"{chr(ord('a') + i)}" * 40,
                base_sha="b" * 40,  # All reference the same base
                provider="github",
                head_repo_name="owner/repo",
                base_repo_name="owner/repo",
                head_ref=f"feature/test{i}",
                base_ref="main",
            )
            head_commit_comparisons.append(head_commit_comparison)

        # Create base artifact
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=base_commit_comparison,
        )

        # Create multiple head artifacts with matching app_id (monorepo scenario)
        head_artifacts = []
        app_ids = [
            "com.example.app",
            "com.example.app",
            "com.example.app",
        ]  # All match base artifact
        for i, app_id in enumerate(app_ids):
            artifact = self.create_preprod_artifact(
                project=self.project,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                app_id=app_id,
                commit_comparison=head_commit_comparisons[i],
            )
            head_artifacts.append(artifact)

        # Get head artifacts from base artifact
        result_artifacts = list(base_artifact.get_head_artifacts_for_commit())
        assert len(result_artifacts) == 3
        assert set(result_artifacts) == set(head_artifacts)
        # Verify all returned artifacts have matching app_id
        for artifact in result_artifacts:
            assert artifact.app_id == base_artifact.app_id

    def test_get_head_artifacts_for_commit_no_matching_app_id(self):
        """Test that method returns empty queryset when no head artifacts have matching app_id."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison that references the base
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifact
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=base_commit_comparison,
        )

        # Create head artifact with different app_id
        self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.different",  # Different app_id from base
            commit_comparison=head_commit_comparison,
        )

        # Get head artifacts from base artifact (should return empty due to no matching app_id)
        head_artifacts = list(base_artifact.get_head_artifacts_for_commit())
        assert len(head_artifacts) == 0

    def test_get_head_artifacts_for_commit_no_head_commits(self):
        """Test that method returns empty queryset when no head commit comparisons exist."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create base artifact
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=base_commit_comparison,
        )

        # Get head artifacts from base artifact (should return empty)
        head_artifacts = list(base_artifact.get_head_artifacts_for_commit())
        assert len(head_artifacts) == 0

    def test_get_head_artifacts_for_commit_cross_org_security(self):
        """Test that head artifacts from different organizations are excluded for security."""
        # Create second organization
        other_org = self.create_organization(name="other_org")
        other_project = self.create_project(organization=other_org, name="other_project")

        # Create base commit comparison for first org
        base_commit_comparison_org1 = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create base commit comparison for second org with same head SHA
        base_commit_comparison_org2 = self.create_commit_comparison(
            organization=other_org,
            head_sha="b" * 40,  # Same SHA as org1
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison for first org
        head_commit_comparison_org1 = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create head commit comparison for second org
        head_commit_comparison_org2 = self.create_commit_comparison(
            organization=other_org,
            head_sha="d" * 40,
            base_sha="b" * 40,  # Same base SHA as org1
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifacts in each org with matching app_ids
        base_artifact_org1 = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=base_commit_comparison_org1,
        )

        base_artifact_org2 = self.create_preprod_artifact(
            project=other_project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",  # Same app_id but different org
            commit_comparison=base_commit_comparison_org2,
        )

        # Create head artifacts in each org with matching app_ids
        head_artifact_org1 = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",  # Matches base_artifact_org1
            commit_comparison=head_commit_comparison_org1,
        )

        head_artifact_org2 = self.create_preprod_artifact(
            project=other_project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",  # Matches base_artifact_org2
            commit_comparison=head_commit_comparison_org2,
        )

        # Query for head artifacts from org1 base should only return org1 head artifacts
        head_artifacts_org1 = list(base_artifact_org1.get_head_artifacts_for_commit())
        assert len(head_artifacts_org1) == 1
        assert head_artifacts_org1[0] == head_artifact_org1
        assert head_artifact_org2 not in head_artifacts_org1

        # Query for head artifacts from org2 base should only return org2 head artifacts
        head_artifacts_org2 = list(base_artifact_org2.get_head_artifacts_for_commit())
        assert len(head_artifacts_org2) == 1
        assert head_artifacts_org2[0] == head_artifact_org2
        assert head_artifact_org1 not in head_artifacts_org2

    def test_get_head_artifacts_for_commit_no_commit_comparison(self):
        """Test that method returns empty queryset when artifact has no commit_comparison."""
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=None,
        )

        head_artifacts = list(artifact.get_head_artifacts_for_commit())
        assert len(head_artifacts) == 0

    def test_get_base_artifact_for_commit_with_artifact_type_filter(self):
        """Test getting base artifact with specific artifact type filter."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifacts with different artifact types
        base_artifact_apk = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=base_commit_comparison,
        )

        base_artifact_aab = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            commit_comparison=base_commit_comparison,
        )

        # Create head artifact with APK type
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=head_commit_comparison,
        )

        # Test filtering by APK type
        result = head_artifact.get_base_artifact_for_commit(
            artifact_type=PreprodArtifact.ArtifactType.APK
        ).first()
        assert result == base_artifact_apk
        assert result.artifact_type == PreprodArtifact.ArtifactType.APK

        # Test filtering by AAB type
        result = head_artifact.get_base_artifact_for_commit(
            artifact_type=PreprodArtifact.ArtifactType.AAB
        ).first()
        assert result == base_artifact_aab
        assert result.artifact_type == PreprodArtifact.ArtifactType.AAB

        # Test filtering by XCARCHIVE type (should return None)
        result = head_artifact.get_base_artifact_for_commit(
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE
        ).first()
        assert result is None

    def test_get_base_artifact_for_commit_with_default_artifact_type(self):
        """Test getting base artifact using default artifact type from the artifact itself."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifact with AAB type
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            commit_comparison=base_commit_comparison,
        )

        # Create head artifact with AAB type (same as base)
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            commit_comparison=head_commit_comparison,
        )

        # Test without specifying artifact_type (should use head_artifact's type)
        result = head_artifact.get_base_artifact_for_commit().first()
        assert result == base_artifact
        assert result.artifact_type == PreprodArtifact.ArtifactType.AAB

    def test_get_head_artifacts_for_commit_with_artifact_type_filter(self):
        """Test getting head artifacts with specific artifact type filter."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create multiple head commit comparisons
        head_commit_comparisons = []
        for i in range(3):
            head_commit_comparison = self.create_commit_comparison(
                organization=self.organization,
                head_sha=f"{chr(ord('a') + i)}" * 40,
                base_sha="b" * 40,
                provider="github",
                head_repo_name="owner/repo",
                base_repo_name="owner/repo",
                head_ref=f"feature/test{i}",
                base_ref="main",
            )
            head_commit_comparisons.append(head_commit_comparison)

        # Create base artifact
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=base_commit_comparison,
        )

        # Create head artifacts with different artifact types
        head_artifact_apk = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=head_commit_comparisons[0],
        )

        head_artifact_aab = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            commit_comparison=head_commit_comparisons[1],
        )

        head_artifact_xcarchive = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=head_commit_comparisons[2],
        )

        # Test filtering by APK type
        result_artifacts = list(
            base_artifact.get_head_artifacts_for_commit(
                artifact_type=PreprodArtifact.ArtifactType.APK
            )
        )
        assert len(result_artifacts) == 1
        assert result_artifacts[0] == head_artifact_apk
        assert result_artifacts[0].artifact_type == PreprodArtifact.ArtifactType.APK

        # Test filtering by AAB type
        result_artifacts = list(
            base_artifact.get_head_artifacts_for_commit(
                artifact_type=PreprodArtifact.ArtifactType.AAB
            )
        )
        assert len(result_artifacts) == 1
        assert result_artifacts[0] == head_artifact_aab
        assert result_artifacts[0].artifact_type == PreprodArtifact.ArtifactType.AAB

        # Test filtering by XCARCHIVE type
        result_artifacts = list(
            base_artifact.get_head_artifacts_for_commit(
                artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE
            )
        )
        assert len(result_artifacts) == 1
        assert result_artifacts[0] == head_artifact_xcarchive
        assert result_artifacts[0].artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE

    def test_get_head_artifacts_for_commit_with_default_artifact_type(self):
        """Test getting head artifacts using default artifact type from the artifact itself."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifact with AAB type
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            commit_comparison=base_commit_comparison,
        )

        # Create head artifact with AAB type (same as base)
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            commit_comparison=head_commit_comparison,
        )

        # Test without specifying artifact_type (should use base_artifact's type)
        result_artifacts = list(base_artifact.get_head_artifacts_for_commit())
        assert len(result_artifacts) == 1
        assert result_artifacts[0] == head_artifact
        assert result_artifacts[0].artifact_type == PreprodArtifact.ArtifactType.AAB

    def test_get_base_artifact_for_commit_artifact_type_no_matches(self):
        """Test getting base artifact when no artifacts match the specified artifact type."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifact with APK type
        self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=base_commit_comparison,
        )

        # Create head artifact with AAB type
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            commit_comparison=head_commit_comparison,
        )

        # Test filtering by AAB type (should return None since base artifact is APK)
        result = head_artifact.get_base_artifact_for_commit(
            artifact_type=PreprodArtifact.ArtifactType.AAB
        ).first()
        assert result is None

    def test_get_head_artifacts_for_commit_artifact_type_no_matches(self):
        """Test getting head artifacts when no artifacts match the specified artifact type."""
        # Create base commit comparison
        base_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="main",
            base_ref="develop",
        )

        # Create head commit comparison
        head_commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create base artifact with APK type
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=base_commit_comparison,
        )

        # Create head artifact with APK type
        self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=head_commit_comparison,
        )

        # Test filtering by AAB type (should return empty since head artifact is APK)
        result_artifacts = list(
            base_artifact.get_head_artifacts_for_commit(
                artifact_type=PreprodArtifact.ArtifactType.AAB
            )
        )
        assert len(result_artifacts) == 0
