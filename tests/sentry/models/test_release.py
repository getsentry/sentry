from __future__ import absolute_import

from sentry.models import (
    Commit, Group, GroupCommitResolution, GroupRelease, GroupResolution,
    GroupResolutionStatus, GroupStatus, Release, ReleaseCommit,
    ReleaseEnvironment, ReleaseProject, Repository
)

from sentry.testutils import TestCase


class MergeReleasesTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=5
        )
        commit2 = Commit.objects.create(
            organization_id=org.id,
            repository_id=6
        )

        # merge to
        project = self.create_project(organization=org, name='foo')
        release = Release.objects.create(version='abcdabc', organization=org)
        release.add_project(project)
        release_commit = ReleaseCommit.objects.create(
            organization_id=org.id,
            release=release,
            commit=commit,
            order=1
        )
        release_environment = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project.id,
            release_id=release.id,
            environment_id=2
        )
        group_release = GroupRelease.objects.create(
            project_id=project.id,
            release_id=release.id,
            group_id=1
        )
        group = self.create_group(project=project, first_release=release)
        group_resolution = GroupResolution.objects.create(
            group=group,
            release=release
        )

        # merge from #1
        project2 = self.create_project(organization=org, name='bar')
        release2 = Release.objects.create(version='bbbbbbb', organization=org)
        release2.add_project(project2)
        release_commit2 = ReleaseCommit.objects.create(
            organization_id=org.id,
            release=release2,
            commit=commit,
            order=2
        )
        release_environment2 = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project2.id,
            release_id=release2.id,
            environment_id=2
        )
        group_release2 = GroupRelease.objects.create(
            project_id=project2.id,
            release_id=release2.id,
            group_id=2
        )
        group2 = self.create_group(project=project2, first_release=release2)
        group_resolution2 = GroupResolution.objects.create(
            group=group2,
            release=release2
        )

        # merge from #2
        project3 = self.create_project(organization=org, name='baz')
        release3 = Release.objects.create(version='cccccc', organization=org)
        release3.add_project(project3)
        release_commit3 = ReleaseCommit.objects.create(
            organization_id=org.id,
            release=release2,
            commit=commit2,
            order=3
        )
        release_environment3 = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project3.id,
            release_id=release3.id,
            environment_id=2
        )
        group_release3 = GroupRelease.objects.create(
            project_id=project3.id,
            release_id=release3.id,
            group_id=3
        )
        group3 = self.create_group(project=project3, first_release=release3)
        group_resolution3 = GroupResolution.objects.create(
            group=group3,
            release=release3
        )

        Release.merge(release, [release2, release3])

        # ReleaseCommit.release
        assert ReleaseCommit.objects.get(id=release_commit.id).release == release
        # should not exist because they referenced the same commit
        assert not ReleaseCommit.objects.filter(id=release_commit2.id).exists()
        assert ReleaseCommit.objects.get(id=release_commit3.id).release == release

        # ReleaseEnvironment.release_id
        assert ReleaseEnvironment.objects.get(id=release_environment.id).release_id == release.id
        assert ReleaseEnvironment.objects.get(id=release_environment2.id).release_id == release.id
        assert ReleaseEnvironment.objects.get(id=release_environment3.id).release_id == release.id

        # ReleaseProject.release
        assert release.projects.count() == 3
        assert ReleaseProject.objects.filter(release=release, project=project).exists()
        assert ReleaseProject.objects.filter(release=release, project=project2).exists()
        assert ReleaseProject.objects.filter(release=release, project=project3).exists()

        # GroupRelease.release_id
        assert GroupRelease.objects.get(id=group_release.id).release_id == release.id
        assert GroupRelease.objects.get(id=group_release2.id).release_id == release.id
        assert GroupRelease.objects.get(id=group_release3.id).release_id == release.id

        # GroupResolution.release
        assert GroupResolution.objects.get(id=group_resolution.id).release == release
        assert GroupResolution.objects.get(id=group_resolution2.id).release == release
        assert GroupResolution.objects.get(id=group_resolution3.id).release == release

        # Group.first_release
        assert Group.objects.get(id=group.id).first_release == release
        assert Group.objects.get(id=group2.id).first_release == release
        assert Group.objects.get(id=group3.id).first_release == release

        # Releases are gone
        assert Release.objects.filter(id=release.id).exists()
        assert not Release.objects.filter(id=release2.id).exists()
        assert not Release.objects.filter(id=release3.id).exists()


class SetCommitsTestCase(TestCase):
    def test_simple(self):
        org = self.create_organization()
        project = self.create_project(organization=org, name='foo')
        group = self.create_group(project=project)

        repo = Repository.objects.create(
            organization_id=org.id,
            name='test/repo',
        )
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message='fixes %s' % (group.qualified_short_id),
            key='alksdflskdfjsldkfajsflkslk',
        )
        commit2 = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message='i fixed something',
            key='lskfslknsdkcsnlkdflksfdkls',
        )

        assert GroupCommitResolution.objects.filter(
            group_id=group.id,
            commit_id=commit.id
        ).exists()

        release = Release.objects.create(version='abcdabc', organization=org)
        release.add_project(project)
        release.set_commits([{
            'id': commit.key,
            'repository': repo.name,
        }, {
            'id': commit2.key,
            'repository': repo.name,
        }])

        assert ReleaseCommit.objects.filter(commit=commit, release=release).exists()
        assert ReleaseCommit.objects.filter(commit=commit2, release=release).exists()
        assert GroupResolution.objects.filter(group=group, release=release).exists()
        assert GroupResolution.objects.get(
            group=group,
            release=release,
        ).status == GroupResolutionStatus.RESOLVED
        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
