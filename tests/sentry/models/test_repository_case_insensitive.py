from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class RepositoryCaseInsensitiveTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()

    def test_get_by_name_case_insensitive_exact_match(self):
        """Test that exact case match works (performance optimization path)."""
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )

        # Should find via exact match
        found = Repository.get_by_name_case_insensitive(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )
        assert found is not None
        assert found.id == repo.id

    def test_get_by_name_case_insensitive_different_case(self):
        """Test that case-insensitive lookup works when case differs."""
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )

        # Should find via case-insensitive lookup
        found = Repository.get_by_name_case_insensitive(
            organization_id=self.organization.id,
            name="myorg/myrepo",  # Different case
            provider="integrations:github",
        )
        assert found is not None
        assert found.id == repo.id
        assert found.name == "MyOrg/MyRepo"  # Original case preserved

    def test_get_by_name_case_insensitive_mixed_case(self):
        """Test various case combinations."""
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )

        test_cases = [
            "MYORG/MYREPO",
            "myorg/MYREPO",
            "MyOrg/myrepo",
            "myOrg/MyRepo",
        ]

        for test_name in test_cases:
            found = Repository.get_by_name_case_insensitive(
                organization_id=self.organization.id,
                name=test_name,
                provider="integrations:github",
            )
            assert found is not None, f"Failed to find repo with name: {test_name}"
            assert found.id == repo.id
            assert found.name == "MyOrg/MyRepo"  # Original case preserved

    def test_get_by_name_case_insensitive_not_found(self):
        """Test that nonexistent repository returns None."""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )

        # Different repo name entirely
        found = Repository.get_by_name_case_insensitive(
            organization_id=self.organization.id,
            name="DifferentOrg/DifferentRepo",
            provider="integrations:github",
        )
        assert found is None

    def test_get_by_name_case_insensitive_wrong_provider(self):
        """Test that wrong provider returns None."""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )

        # Same name but different provider
        found = Repository.get_by_name_case_insensitive(
            organization_id=self.organization.id,
            name="myorg/myrepo",
            provider="integrations:gitlab",  # Different provider
        )
        assert found is None

    def test_get_by_name_case_insensitive_wrong_organization(self):
        """Test that wrong organization returns None."""
        other_org = self.create_organization()
        Repository.objects.create(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )

        # Same name but different organization
        found = Repository.get_by_name_case_insensitive(
            organization_id=other_org.id,  # Different org
            name="myorg/myrepo",
            provider="integrations:github",
        )
        assert found is None

    def test_get_by_name_case_insensitive_multiple_repos_different_orgs(self):
        """Test that lookup correctly scopes by organization."""
        other_org = self.create_organization()

        repo1 = Repository.objects.create(
            organization_id=self.organization.id,
            name="MyOrg/MyRepo",
            provider="integrations:github",
        )
        repo2 = Repository.objects.create(
            organization_id=other_org.id,
            name="myorg/myrepo",  # Same name, different case, different org
            provider="integrations:github",
        )

        # Should find the right repo for each org
        found1 = Repository.get_by_name_case_insensitive(
            organization_id=self.organization.id,
            name="myorg/myrepo",
            provider="integrations:github",
        )
        found2 = Repository.get_by_name_case_insensitive(
            organization_id=other_org.id,
            name="MYORG/MYREPO",
            provider="integrations:github",
        )

        assert found1.id == repo1.id
        assert found2.id == repo2.id
