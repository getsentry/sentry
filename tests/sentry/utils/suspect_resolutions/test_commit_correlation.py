from sentry.models import Commit, CommitFileChange, GroupRelease, GroupStatus, ReleaseCommit
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions.commit_correlation import (
    get_files_changed,
    is_issue_commit_correlated,
)


class TestCommitCorrelation(TestCase):
    def test_get_files_changed(self):
        project = self.create_project()
        group = self.create_group(project=project)
        release = self.create_release(project=project, version="1")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="1"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".random"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".random2"
        )
        GroupRelease.objects.create(project_id=project.id, group_id=group.id, release_id=release.id)

        assert len(get_files_changed(group.id, project.id)) == 2
        assert get_files_changed(group.id, project.id) == {".random", ".random2"}

    def test_no_files_changed(self):
        project = self.create_project()
        group1 = self.create_group(project=project)
        group2 = self.create_group(project=project)
        release = self.create_release(project=project, version="1")
        release2 = self.create_release(project=project, version="2")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="1"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release2, commit=commit, order=1
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group1.id, release_id=release.id
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group2.id, release_id=release2.id
        )

        assert get_files_changed(group1.id, project.id) == set()
        assert get_files_changed(group2.id, project.id) == set()
        assert not is_issue_commit_correlated(group1.id, group2.id, project.id)

    def test_files_changed_unreleased(self):
        project = self.create_project()
        group = self.create_group(project=project)
        release = self.create_release(project=project, version="1")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="1"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".random"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".random2"
        )
        GroupRelease.objects.create(project_id=project.id, group_id=group.id, release_id=release.id)

        assert get_files_changed(group.id, project.id) == set()

    def test_is_issue_commit_correlated_with_shared_files(self):
        project = self.create_project()
        release = self.create_release()
        release2 = self.create_release()
        repo = self.create_repo()
        group1 = self.create_group(project=project, status=GroupStatus.RESOLVED)
        group2 = self.create_group()
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
            project_id=project.id, group_id=group1.id, release_id=release.id
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group2.id, release_id=release2.id
        )

        assert get_files_changed(group1.id, project.id) == {".gitignore", ".komal"}
        assert get_files_changed(group2.id, project.id) == {".gitignore"}
        assert len(get_files_changed(group1.id, project.id)) == 2
        assert len(get_files_changed(group2.id, project.id)) == 1
        assert is_issue_commit_correlated(group1.id, group2.id, project.id)

    def test_is_issue_commit_correlated_no_shared_files(self):
        project = self.create_project()
        release = self.create_release()
        release2 = self.create_release()
        repo = self.create_repo()
        group1 = self.create_group(project=project, status=GroupStatus.RESOLVED)
        group2 = self.create_group()
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
            organization_id=project.organization_id, commit=commit2, filename=".random2"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".komal"
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group1.id, release_id=release.id
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group2.id, release_id=release2.id
        )

        assert get_files_changed(group1.id, project.id) == {".gitignore", ".komal"}
        assert get_files_changed(group2.id, project.id) == {".random", ".random2"}
        assert len(get_files_changed(group1.id, project.id)) == 2
        assert len(get_files_changed(group2.id, project.id)) == 2
        assert not is_issue_commit_correlated(group1.id, group2.id, project.id)
