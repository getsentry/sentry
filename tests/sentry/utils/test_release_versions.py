from __future__ import absolute_import

from sentry import models
from sentry.models import (
    Commit, Group, GroupRelease, GroupResolution, Release,
    ReleaseCommit, ReleaseEnvironment, ReleaseProject, TagValue
)
from sentry.utils import release_versions
from sentry.testutils import TestCase


def test_is_full_sha():
    assert release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad604453c6')
    assert not release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad604453gg')
    assert not release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad604453c')
    assert release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad')


def test_is_short_sha():
    assert release_versions.is_short_sha('0e55bed8164b977c8f12a75811473cad604453c6')
    assert release_versions.is_short_sha('0e55bed8164b977c8f12a75811473cad604453c')
    assert release_versions.is_short_sha('0e55bed8164b977c8f12a75811473cad')
    assert release_versions.is_short_sha('0e55bed')
    assert not release_versions.is_short_sha('0e55beg')


def test_is_semver_like():
    assert release_versions.is_semver_like('something-1.0.0')
    assert release_versions.is_semver_like('something-v1.0.0')
    assert release_versions.is_semver_like('1.0.0')
    assert release_versions.is_semver_like('v1.0.0')
    assert release_versions.is_semver_like('v-1.0.0')


def test_is_travis_build():
    assert release_versions.is_travis_build('TRAVIS_12345')
    assert release_versions.is_travis_build('TRAVIS-12345')


def test_is_jenkins_build():
    assert release_versions.is_jenkins_build('jenkins-123-abcdeff')
    assert release_versions.is_jenkins_build('jenkins_123_abcdeff')
    assert not release_versions.is_jenkins_build('jenkins_123_abcdefg')


def test_is_head_tag():
    assert release_versions.is_head_tag('HEAD-abcdeff')
    assert release_versions.is_head_tag('master@abcdeff')
    assert release_versions.is_head_tag('master(abcdeff)')
    assert release_versions.is_head_tag('qa-abcdeff')
    assert not release_versions.is_head_tag('master@abcdefg')


def test_is_short_sha_and_date():
    assert release_versions.is_short_sha_and_date('abcdeff-2016-03-16')
    assert not release_versions.is_short_sha_and_date('abcdeff-03-16')


def is_word_and_date():
    assert release_versions.is_word_and_date('release-2016-01-01')
    assert not release_versions.is_word_and_date('release-01-01')


class MergeReleasesTest(TestCase):
    def test_simple(self):
        version = 'abcdabc'
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
        release = Release.objects.create(version=version, organization=org)
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
        release2 = Release.objects.create(version=version, organization=org)
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
        release3 = Release.objects.create(version=version, organization=org)
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

        release_versions.merge(release, [release2, release3], models)

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


class UpdateReleaseVersion(TestCase):
    def test_simple(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = Release.objects.create(organization=org, version='abcdefg')
        release.add_project(project)
        tag = TagValue.objects.create(
            project=project,
            key='sentry:release',
            value='abcdefg'
        )
        new_version = '%s-abcdefg' % (project.slug)
        release_versions.update_version(release, models)
        assert Release.objects.get(id=release.id).version == new_version
        assert TagValue.objects.get(id=tag.id).value == new_version
