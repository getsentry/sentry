"""
Test that releases can handle more than 250 commits with distinct authors.

This test file addresses customer concerns about a potential 250 commit/author limit
reported in the #discuss-integrations Slack channel.
"""

from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class ReleaseCommitAuthorLimitTest(TestCase):
    """Test that releases can handle more than 250 commits with distinct authors."""

    def test_release_with_more_than_250_commit_authors(self) -> None:
        """
        Verify that a release can have more than 250 commits with distinct authors.
        This test addresses customer concerns about a potential 250 commit/author limit.

        Background: Canva (enterprise customer) reported that some authors are missing
        from their release author lists, and they suspected a 250 commit limit might exist.
        """
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="test-project")
        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        release = Release.objects.create(version="1.0.0-large-commit-test", organization=org)
        release.add_project(project)

        # Create 300 commits with 300 distinct authors to verify no 250 limit exists
        num_commits = 300
        commits = []
        for i in range(num_commits):
            commits.append(
                {
                    "id": f"{'a' * 39}{i:01x}",  # Unique 40-char commit SHA
                    "repository": repo.name,
                    "author_email": f"author{i}@example.com",
                    "author_name": f"Author {i}",
                    "message": f"commit {i}",
                }
            )

        # Set all commits on the release
        release.set_commits(commits)

        # Verify all commits were created
        release_commits = ReleaseCommit.objects.filter(release=release)
        assert release_commits.count() == num_commits

        # Verify the release has the correct commit count
        release.refresh_from_db()
        assert release.commit_count == num_commits

        # Verify all distinct authors were captured
        assert len(release.authors) == num_commits, (
            f"Expected {num_commits} authors in release.authors, "
            f"but got {len(release.authors)}. This may indicate a hidden limit."
        )

        # Verify all commit authors were created
        commit_authors = CommitAuthor.objects.filter(
            organization_id=org.id, email__startswith="author"
        )
        assert commit_authors.count() == num_commits

        # Verify authors at key positions are correctly associated
        # Particularly checking around the suspected 250 limit
        for i in [0, 100, 200, 249, 250, 251, 299]:
            author = CommitAuthor.objects.get(
                organization_id=org.id, email=f"author{i}@example.com"
            )
            assert str(author.id) in release.authors, (
                f"Author {i} (email: author{i}@example.com, id: {author.id}) "
                f"not found in release.authors. This suggests authors after position {i} may be missing."
            )

    def test_release_with_exactly_250_commit_authors(self) -> None:
        """
        Test with exactly 250 commits to establish a baseline.
        """
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="test-project")
        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        release = Release.objects.create(version="1.0.0-exactly-250", organization=org)
        release.add_project(project)

        # Create exactly 250 commits
        num_commits = 250
        commits = []
        for i in range(num_commits):
            commits.append(
                {
                    "id": f"{'b' * 39}{i:01x}",
                    "repository": repo.name,
                    "author_email": f"author{i}@example.com",
                    "author_name": f"Author {i}",
                    "message": f"commit {i}",
                }
            )

        release.set_commits(commits)

        # Verify all commits and authors were created
        release.refresh_from_db()
        assert release.commit_count == num_commits
        assert len(release.authors) == num_commits

        # Verify the last author (index 249) is included
        last_author = CommitAuthor.objects.get(
            organization_id=org.id, email="author249@example.com"
        )
        assert str(last_author.id) in release.authors

    def test_release_authors_query_efficiency(self) -> None:
        """
        Verify that the query to populate release.authors doesn't have implicit limits.

        This test checks that the .distinct() query in set_commits.py properly
        retrieves all unique author IDs without truncation.
        """
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="test-project")
        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        release = Release.objects.create(version="1.0.0-query-test", organization=org)
        release.add_project(project)

        # Create 350 commits to test well beyond any suspected limit
        num_commits = 350
        commits = []
        for i in range(num_commits):
            commits.append(
                {
                    "id": f"{'c' * 39}{i:03x}",
                    "repository": repo.name,
                    "author_email": f"test{i}@example.com",
                    "author_name": f"Test Author {i}",
                    "message": f"Test commit {i}",
                }
            )

        release.set_commits(commits)
        release.refresh_from_db()

        # Verify all authors are present
        assert len(release.authors) == num_commits

        # Verify the query that populates authors doesn't skip any
        release_commit_author_ids = set(
            ReleaseCommit.objects.filter(release=release, commit__author_id__isnull=False)
            .values_list("commit__author_id", flat=True)
            .distinct()
        )

        # Compare with release.authors (stored as strings)
        stored_author_ids = {int(author_id) for author_id in release.authors}

        assert release_commit_author_ids == stored_author_ids, (
            f"Mismatch between ReleaseCommit authors and stored release.authors. "
            f"Expected {len(release_commit_author_ids)} but got {len(stored_author_ids)}"
        )
