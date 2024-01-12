from datetime import timedelta

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.group import GroupStatus
from sentry.models.grouprelease import GroupRelease
from sentry.models.releasecommit import ReleaseCommit
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.utils.suspect_resolutions.commit_correlation import (
    get_files_changed_in_releases,
    is_issue_commit_correlated,
)


@region_silo_test
class CommitCorrelationTest(TestCase):
    def setup(self, status=GroupStatus.RESOLVED):
        project = self.create_project()
        issue = self.create_group(project=project, status=status, resolved_at=timezone.now())
        release = self.create_release(
            project=project, version="1", date_added=timezone.now() - timedelta(hours=3)
        )
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
        GroupRelease.objects.create(
            project_id=project.id,
            group_id=issue.id,
            release_id=release.id,
        )

        return project, issue, release, repo

    def test_get_files_changed_resolved_in_release(self):
        (project, issue, release, repo) = self.setup()
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        files_changed = get_files_changed_in_releases(timezone.now(), issue.id, project.id)

        assert files_changed.files_changed == {".random", ".random2"}
        assert files_changed.release_ids[0] == release.id

    def test_get_files_changed_resolved_in_commit(self):
        (project, issue, release, repo) = self.setup()
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        )
        res = get_files_changed_in_releases(timezone.now(), issue.id, project.id)
        release_ids, files_changed = (res.release_ids, res.files_changed)

        assert files_changed == {".random", ".random2"}
        assert release_ids[0] == release.id

    def test_get_files_changed_resolved_in_pull_request(self):
        (project, issue, release, repo) = self.setup()
        Activity.objects.create(
            project=project, group=issue, type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
        )
        res = get_files_changed_in_releases(timezone.now(), issue.id, project.id)
        release_ids, files_changed = (res.release_ids, res.files_changed)

        assert files_changed == {".random", ".random2"}
        assert release_ids[0] == release.id

    def test_get_files_changed_unresolved_issue(self):
        (project, issue, release, repo) = self.setup(status=GroupStatus.UNRESOLVED)
        res = get_files_changed_in_releases(timezone.now(), issue.id, project.id)
        release_ids, files_changed = (res.release_ids, res.files_changed)

        assert files_changed == {".random", ".random2"}
        assert release_ids[0] == release.id

    def test_get_files_changed_manually_resolved(self):
        (project, issue, release, repo) = self.setup()
        res = get_files_changed_in_releases(timezone.now(), issue.id, project.id)
        release_ids, files_changed = (res.release_ids, res.files_changed)

        assert files_changed == {".random", ".random2"}
        assert release_ids[0] == release.id

    def test_no_files_changed(self):
        project = self.create_project()
        group1 = self.create_group(project=project, resolved_at=timezone.now())
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
            project_id=project.id,
            group_id=group1.id,
            release_id=release.id,
            last_seen=(group1.resolved_at - timedelta(hours=2)),
        )
        GroupRelease.objects.create(
            project_id=project.id,
            group_id=group2.id,
            release_id=release2.id,
            last_seen=(group1.resolved_at - timedelta(hours=2)),
        )

        res1 = get_files_changed_in_releases(group1.resolved_at, group1.id, project.id)
        res2 = get_files_changed_in_releases(group1.resolved_at, group2.id, project.id)

        assert res1.files_changed == set()
        assert res2.files_changed == set()
        assert res1.release_ids[0] == release.id
        assert res2.release_ids[0] == release2.id
        assert not is_issue_commit_correlated(group1.id, group2.id, project.id).is_correlated

    def test_files_changed_unreleased_commits(self):
        project = self.create_project()
        group = self.create_group(project=project, resolved_at=timezone.now())
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
        GroupRelease.objects.create(
            project_id=project.id,
            group_id=group.id,
            release_id=release.id,
            last_seen=(timezone.now() - timedelta(hours=2)),
        )

        res = get_files_changed_in_releases(group.resolved_at, group.id, project.id)
        release_ids, files_changed = (res.release_ids, res.files_changed)

        assert files_changed == set()
        assert release_ids[0] == release.id

    def test_get_files_changed_shared_files(self):
        (project, issue, release, repo) = self.setup()
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
            project_id=project.id,
            group_id=issue2.id,
            release_id=release2.id,
            last_seen=(timezone.now() - timedelta(hours=2)),
        )

        res1 = get_files_changed_in_releases(issue.resolved_at, issue.id, project.id)
        res2 = get_files_changed_in_releases(issue.resolved_at, issue2.id, project.id)

        assert res1.files_changed == {".random", ".random2"}
        assert res2.files_changed == {".random"}
        assert is_issue_commit_correlated(issue.id, issue2.id, project.id)

    def test_get_files_changed_no_shared_files(self):
        (project, issue, release, repo) = self.setup()
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

        res1 = get_files_changed_in_releases(issue.resolved_at, issue.id, project.id)
        res2 = get_files_changed_in_releases(issue.resolved_at, issue2.id, project.id)

        assert res1.files_changed == {".random", ".random2"}
        assert res2.files_changed == {".gitignore"}
        assert res1.release_ids[0] == release.id
        assert res2.release_ids[0] == release2.id
        assert not is_issue_commit_correlated(issue.id, issue2.id, project.id).is_correlated

    def get_files_changed_outside_of_time_window(self):
        project = self.create_project()
        group = self.create_group(project=project, resolved_at=timezone.now())
        release = self.create_release(
            project=project, version="1", date_added=timezone.now() - timedelta(hours=8)
        )
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
        GroupRelease.objects.create(
            project_id=project.id,
            group_id=group.id,
            release_id=release.id,
        )

        res = get_files_changed_in_releases(group.resolved_at, group.id, project.id)
        assert res.files_changed == set()
