from sentry.models import Commit, CommitFileChange, GroupRelease, ReleaseCommit
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions.commit_correlation import (
    get_files_changed,
    is_issue_commit_correlated,
)


class TestCommitCorrelation(TestCase):
    def test_get_files_changed(self):
        project = self.create_project()
        release = self.create_release(project=project, version="1")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="a" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".komal"
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=1,
            release_id=release.id,
            environment=self.environment.name,
            first_seen="2020-05-06 12:00:00",
        )

        assert get_files_changed(1, start="2020-01-01 12:00:00", end="2021-02-25 12:00:00") == {
            ".gitignore",
            ".komal",
        }

    def test_is_issue_commit_correlated_with_shared_files(self):
        project = self.create_project()
        release = self.create_release(project=project, version="1")
        release2 = self.create_release(project=project, version="2")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="1"
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="2"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release2, commit=commit2, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit2, filename=".gitignore"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".komal"
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=1,
            release_id=release.id,
            environment=self.environment.name,
            first_seen="2021-02-27 12:00:00",
            last_seen="2022-02-27 12:00:00",
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=2,
            release_id=release2.id,
            environment=self.environment.name,
            first_seen="2021-03-20 12:00:00",
            last_seen="2022-03-27 12:00:00",
        )

        assert is_issue_commit_correlated(1, 2)

    def test_is_issue_commit_correlated_no_shared_files(self):
        project = self.create_project()
        release = self.create_release(project=project, version="1")
        release2 = self.create_release(project=project, version="2")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="1"
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="2"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release2, commit=commit2, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit2, filename=".random"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".komal"
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=1,
            release_id=release.id,
            environment=self.environment.name,
            first_seen="2022-04-25 11:00:00",
            last_seen="2022-05-26 11:00:00",
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=2,
            release_id=release2.id,
            environment=self.environment.name,
            first_seen="2022-02-01 8:00:00",
            last_seen="2022-06-26 11:00:00",
        )

        assert not is_issue_commit_correlated(1, 2)

    def test_no_changed_files(self):
        project = self.create_project()
        release = self.create_release(project=project, version="1")
        release2 = self.create_release(project=project, version="2")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="1"
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="2"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release2, commit=commit2, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore"
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=1,
            release_id=release.id,
            environment=self.environment.name,
            first_seen="2022-05-30 12:00:00",
            last_seen="2022-06-01 11:00:00",
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=2,
            release_id=release2.id,
            environment=self.environment.name,
            first_seen="2022-01-03 12:00:00",
            last_seen="2022-05-26 11:00:00",
        )

        assert not is_issue_commit_correlated(1, 2)
