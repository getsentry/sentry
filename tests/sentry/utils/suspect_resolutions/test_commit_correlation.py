from sentry.models import (
    Activity,
    Commit,
    CommitFileChange,
    GroupRelease,
    GroupStatus,
    ReleaseCommit,
)
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType
from sentry.utils.suspect_resolutions.commit_correlation import (
    get_files_changed,
    is_issue_commit_correlated,
)


def setup(self, status):
    project = self.create_project()
    issue = self.create_group(project=project, status=status)
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
    GroupRelease.objects.create(project_id=project.id, group_id=issue.id, release_id=release.id)

    return project, issue, release, repo


class CommitCorrelationTest(TestCase):
    def test_get_files_changed_resolved_in_release(self):
        (project, issue, release, repo) = setup(self, status=GroupStatus.RESOLVED)
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        assert len(get_files_changed(issue, project)) == 2
        assert get_files_changed(issue, project) == {".random", ".random2"}

    def test_get_files_changed_resolved_in_commit(self):
        (project, issue, release, repo) = setup(self, status=GroupStatus.RESOLVED)
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        )
        assert get_files_changed(issue, project) == {".random", ".random2"}

    def test_get_files_changed_resolved_in_pull_request(self):
        (project, issue, release, repo) = setup(self, status=GroupStatus.RESOLVED)
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
        )
        assert len(get_files_changed(issue, project)) == 2
        assert get_files_changed(issue, project) == {".random", ".random2"}

    def test_get_files_changed_unresolved_issue(self):
        (project, issue, release, repo) = setup(self, status=GroupStatus.UNRESOLVED)
        assert len(get_files_changed(issue, project)) == 2
        assert get_files_changed(issue, project) == {".random", ".random2"}

    def test_get_files_changed_manually_resolved(self):
        (project, issue, release, repo) = setup(self, status=GroupStatus.RESOLVED)
        assert get_files_changed(issue, project) == {".random", ".random2"}

    def test_no_files_changed(self):
        project = self.create_project()
        group1 = self.create_group(project=project)
        group2 = self.create_group(project=project, status=GroupStatus.UNRESOLVED)
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

        assert not is_issue_commit_correlated(group1, group2, project)

    def test_files_changed_unreleased_commits(self):
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

        assert get_files_changed(group, project) == set()

    def get_files_changed_shared_files(self):
        (project, issue, release, repo) = setup(self, status=GroupStatus.RESOLVED)
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        )
        release2 = self.create_release()
        issue2 = self.create_group()
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="2"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release2, commit=commit2, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit2, filename=".random"
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=issue2.id, release_id=release2.id
        )

        assert get_files_changed(issue, project) == {".random", ".random2"}
        assert get_files_changed(issue2, project) == {".random"}
        assert len(get_files_changed(issue, project)) == 2
        assert len(get_files_changed(issue2, project)) == 1
        assert is_issue_commit_correlated(issue, issue2, project)

    def get_files_changed_no_shared_files(self):
        (project, issue, release, repo) = setup(self, status=GroupStatus.RESOLVED)
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        )
        release2 = self.create_release()
        issue2 = self.create_group()
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="2"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release2, commit=commit2, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit2, filename=".gitignore"
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=issue2.id, release_id=release2.id
        )

        assert get_files_changed(issue, project) == {".random", ".random2"}
        assert get_files_changed(issue2, project) == {".gitignore"}
        assert len(get_files_changed(issue, project)) == 2
        assert len(get_files_changed(issue2, project)) == 1
        assert not is_issue_commit_correlated(issue, issue2, project)
