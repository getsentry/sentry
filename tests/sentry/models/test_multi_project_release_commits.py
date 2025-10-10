#!/usr/bin/env python3
"""
Test to reproduce the bug where commits are only shown for the latest added project
when associating multiple projects with the same release.

This test demonstrates the issue described in the bug report:
1. Create two repositories (frontend and backend)
2. Create a release and associate it with both projects
3. Set commits for frontend repository
4. Set commits for backend repository
5. Verify that commits from both repositories are preserved (currently fails)
"""

from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class MultiProjectReleaseCommitsTest(TestCase):
    def test_multiple_projects_same_release_commits_preserved(self):
        """
        Test that when setting commits for a release from multiple repositories,
        all commits are preserved (not just the latest repository's commits).

        This test reproduces the bug where only the latest project's commits
        are shown when multiple projects are associated with the same release.
        """
        # Setup organization and projects
        org = self.create_organization(owner=Factories.create_user())
        frontend_project = self.create_project(organization=org, name="frontend")
        backend_project = self.create_project(organization=org, name="backend")

        # Create repositories for each project
        frontend_repo = Repository.objects.create(organization_id=org.id, name="frontend-repo")
        backend_repo = Repository.objects.create(organization_id=org.id, name="backend-repo")

        # Create a release and associate both projects
        release = Release.objects.create(version="app@1.0.0", organization=org)
        release.add_project(frontend_project)
        release.add_project(backend_project)

        # Simulate first sentry-cli call: set commits for frontend
        frontend_commits = [
            {
                "id": "frontend_commit_1",
                "repository": frontend_repo.name,
                "message": "Fix frontend bug",
            },
            {
                "id": "frontend_commit_2",
                "repository": frontend_repo.name,
                "message": "Update frontend UI",
            },
        ]
        release.set_commits(frontend_commits)

        # Verify frontend commits are added
        frontend_release_commits = ReleaseCommit.objects.filter(
            release=release, commit__repository_id=frontend_repo.id
        ).count()
        assert frontend_release_commits == 2, "Frontend commits should be added"

        # Simulate second sentry-cli call: set commits for backend
        backend_commits = [
            {
                "id": "backend_commit_1",
                "repository": backend_repo.name,
                "message": "Fix backend API",
            },
            {
                "id": "backend_commit_2",
                "repository": backend_repo.name,
                "message": "Update backend logic",
            },
        ]
        release.set_commits(backend_commits)

        # Verify backend commits are added
        backend_release_commits = ReleaseCommit.objects.filter(
            release=release, commit__repository_id=backend_repo.id
        ).count()
        assert backend_release_commits == 2, "Backend commits should be added"

        # BUG: This assertion will fail because frontend commits are deleted
        # when backend commits are set
        frontend_release_commits_after = ReleaseCommit.objects.filter(
            release=release, commit__repository_id=frontend_repo.id
        ).count()

        # This should pass but currently fails due to the bug
        assert frontend_release_commits_after == 2, (
            "Frontend commits should be preserved when backend commits are added, "
            f"but got {frontend_release_commits_after} frontend commits"
        )

        # Total commits should be 4 (2 frontend + 2 backend)
        total_commits = ReleaseCommit.objects.filter(release=release).count()
        assert (
            total_commits == 4
        ), f"Expected 4 total commits (2 frontend + 2 backend), but got {total_commits}"

        # Verify we can retrieve commits for each repository separately
        frontend_commits_retrieved = ReleaseCommit.objects.filter(
            release=release, commit__repository_id=frontend_repo.id
        ).values_list("commit__key", flat=True)

        backend_commits_retrieved = ReleaseCommit.objects.filter(
            release=release, commit__repository_id=backend_repo.id
        ).values_list("commit__key", flat=True)

        assert "frontend_commit_1" in frontend_commits_retrieved
        assert "frontend_commit_2" in frontend_commits_retrieved
        assert "backend_commit_1" in backend_commits_retrieved
        assert "backend_commit_2" in backend_commits_retrieved
