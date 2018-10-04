from __future__ import absolute_import

import six
from mock import patch

from sentry.models import (
    Commit, CommitAuthor, Environment, Group, GroupRelease, GroupResolution, GroupLink, GroupStatus,
    ExternalIssue, Integration, OrganizationIntegration, Release, ReleaseCommit, ReleaseEnvironment,
    ReleaseHeadCommit, ReleaseProject, ReleaseProjectEnvironment, Repository
)

from sentry.testutils import TestCase


class MergeReleasesTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        commit = Commit.objects.create(organization_id=org.id, repository_id=5)
        commit2 = Commit.objects.create(organization_id=org.id, repository_id=6)

        # merge to
        project = self.create_project(organization=org, name='foo')
        environment = Environment.get_or_create(project=project, name='env1')
        release = Release.objects.create(version='abcdabc', organization=org)
        release.add_project(project)
        release_commit = ReleaseCommit.objects.create(
            organization_id=org.id, release=release, commit=commit, order=1
        )
        release_environment = ReleaseEnvironment.objects.create(
            organization_id=org.id, project_id=project.id, release_id=release.id, environment_id=environment.id
        )
        release_project_environment = ReleaseProjectEnvironment.objects.create(
            release_id=release.id, project_id=project.id, environment_id=environment.id
        )
        group_release = GroupRelease.objects.create(
            project_id=project.id, release_id=release.id, group_id=1
        )
        group = self.create_group(project=project, first_release=release)
        group_resolution = GroupResolution.objects.create(group=group, release=release)

        # merge from #1
        project2 = self.create_project(organization=org, name='bar')
        environment2 = Environment.get_or_create(project=project2, name='env2')
        release2 = Release.objects.create(version='bbbbbbb', organization=org)
        release2.add_project(project2)
        release_commit2 = ReleaseCommit.objects.create(
            organization_id=org.id, release=release2, commit=commit, order=2
        )
        release_environment2 = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project2.id,
            release_id=release2.id,
            environment_id=environment2.id,
        )
        release_project_environment2 = ReleaseProjectEnvironment.objects.create(
            release_id=release2.id, project_id=project2.id, environment_id=environment2.id
        )
        group_release2 = GroupRelease.objects.create(
            project_id=project2.id, release_id=release2.id, group_id=2
        )
        group2 = self.create_group(project=project2, first_release=release2)
        group_resolution2 = GroupResolution.objects.create(group=group2, release=release2)

        # merge from #2
        project3 = self.create_project(organization=org, name='baz')
        environment3 = Environment.get_or_create(project=project3, name='env3')
        release3 = Release.objects.create(version='cccccc', organization=org)
        release3.add_project(project3)
        release_commit3 = ReleaseCommit.objects.create(
            organization_id=org.id, release=release2, commit=commit2, order=3
        )
        release_environment3 = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project3.id,
            release_id=release3.id,
            environment_id=environment3.id,
        )
        release_project_environment3 = ReleaseProjectEnvironment.objects.create(
            release_id=release3.id, project_id=project3.id, environment_id=environment3.id
        )
        group_release3 = GroupRelease.objects.create(
            project_id=project3.id, release_id=release3.id, group_id=3
        )
        group3 = self.create_group(project=project3, first_release=release3)
        group_resolution3 = GroupResolution.objects.create(group=group3, release=release3)

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

        # ReleaseProjectEnvironment.release
        assert ReleaseProjectEnvironment.objects.get(
            id=release_project_environment.id).release_id == release.id
        assert ReleaseProjectEnvironment.objects.get(
            id=release_project_environment2.id).release_id == release.id
        assert ReleaseProjectEnvironment.objects.get(
            id=release_project_environment3.id).release_id == release.id

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

    def test_short_version_dotted_prefix(self):
        org = self.create_organization()

        release = Release.objects.create(version='foo.bar.Baz-1.0', organization=org)

        assert release.version == 'foo.bar.Baz-1.0'
        assert release.short_version == '1.0'


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

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        release = Release.objects.create(version='abcdabc', organization=org)
        release.add_project(project)
        release.set_commits(
            [
                {
                    'id': commit.key,
                    'repository': repo.name,
                }, {
                    'id': commit2.key,
                    'repository': repo.name,
                }, {
                    'id': 'a' * 40,
                    'repository': repo.name,
                }, {
                    'id': 'b' * 40,
                    'repository': repo.name,
                    'message': '#skipsentry',
                }
            ]
        )

        assert ReleaseCommit.objects.filter(commit=commit, release=release).exists()
        assert ReleaseCommit.objects.filter(commit=commit2, release=release).exists()

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
        # test that backfilling works
        assert Commit.objects.filter(key='a' * 40, repository_id=repo.id).exists()
        assert not Commit.objects.filter(key='b' * 40, repository_id=repo.id).exists()

        release = Release.objects.get(id=release.id)
        assert release.commit_count == 3
        assert release.authors == []
        assert release.last_commit_id == commit.id

        assert ReleaseHeadCommit.objects.filter(
            release_id=release.id,
            commit_id=commit.id,
            repository_id=repo.id,
        ).exists()

    def test_backfilling_commits(self):
        org = self.create_organization()
        project = self.create_project(organization=org, name='foo')
        group = self.create_group(project=project)

        repo = Repository.objects.create(
            organization_id=org.id,
            name='test/repo',
        )

        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=org.id,
            key='b' * 40,
        )

        release = Release.objects.create(version='abcdabc', organization=org)
        release.add_project(project)
        release.set_commits(
            [
                {
                    'id': 'a' * 40,
                    'repository': repo.name,
                    'author_email': 'foo@example.com',
                    'author_name': 'foo bar baz',
                    'message': 'i fixed a bug',
                }, {
                    'id': 'b' * 40,
                    'repository': repo.name,
                    'author_email': 'foo@example.com',
                    'author_name': 'foo bar baz',
                    'message': 'i fixed another bug',
                }, {
                    'id': 'c' * 40,
                    'repository': repo.name,
                    'author_email': 'foo@example.com',
                    'author_name': 'foo bar baz',
                    'message': 'fixes %s' % (group.qualified_short_id),
                }
            ]
        )

        assert Commit.objects.filter(
            repository_id=repo.id,
            organization_id=org.id,
            key='a' * 40,
        ).exists()
        assert Commit.objects.filter(
            repository_id=repo.id,
            organization_id=org.id,
            key='c' * 40,
        ).exists()

        author = CommitAuthor.objects.get(
            name='foo bar baz',
            email='foo@example.com',
            organization_id=org.id,
        )

        # test that backfilling fills in missing message and author
        commit = Commit.objects.get(id=commit.id)
        assert commit.message == 'i fixed another bug'
        assert commit.author
        assert commit.author.email == 'foo@example.com'
        assert commit.author.name == 'foo bar baz'

        assert ReleaseCommit.objects.filter(
            commit__key='a' * 40,
            commit__repository_id=repo.id,
            release=release,
        ).exists()
        assert ReleaseCommit.objects.filter(
            commit__key='b' * 40,
            commit__repository_id=repo.id,
            release=release,
        ).exists()
        assert ReleaseCommit.objects.filter(
            commit__key='c' * 40,
            commit__repository_id=repo.id,
            release=release,
        ).exists()

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=Commit.objects.get(
                key='c' * 40,
                repository_id=repo.id,
            ).id
        ).exists()

        assert GroupResolution.objects.filter(group=group, release=release).exists()
        assert GroupResolution.objects.get(
            group=group,
            release=release,
        ).status == GroupResolution.Status.resolved
        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

        latest_commit = Commit.objects.get(
            repository_id=repo.id,
            key='a' * 40,
        )

        release = Release.objects.get(id=release.id)
        assert release.commit_count == 3
        assert release.authors == [six.text_type(author.id)]
        assert release.last_commit_id == latest_commit.id

    def test_using_saved_data(self):
        org = self.create_organization()
        project = self.create_project(organization=org, name='foo')

        repo = Repository.objects.create(
            organization_id=org.id,
            name='test/repo',
        )

        author = CommitAuthor.objects.create(
            name='foo bar baz',
            email='foo@example.com',
            organization_id=org.id,
        )

        Commit.objects.create(
            repository_id=repo.id,
            organization_id=org.id,
            key='b' * 40,
            author=author,
        )

        release = Release.objects.create(version='abcdabc', organization=org)
        release.add_project(project)
        release.set_commits(
            [
                {
                    'id': 'a' * 40,
                    'repository': repo.name,
                }, {
                    'id': 'b' * 40,
                    'repository': repo.name,
                }, {
                    'id': 'c' * 40,
                    'repository': repo.name,
                }
            ]
        )

        assert Commit.objects.filter(
            repository_id=repo.id,
            organization_id=org.id,
            key='a' * 40,
        ).exists()
        assert Commit.objects.filter(
            repository_id=repo.id,
            organization_id=org.id,
            key='c' * 40,
        ).exists()

        latest_commit = Commit.objects.get(
            repository_id=repo.id,
            key='a' * 40,
        )

        release = Release.objects.get(id=release.id)
        assert release.commit_count == 3
        assert release.authors == [six.text_type(author.id)]
        assert release.last_commit_id == latest_commit.id

    def test_resolution_support_full_featured(self):
        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org, name='foo')
        group = self.create_group(project=project)

        repo = Repository.objects.create(
            organization_id=org.id,
            name='test/repo',
        )
        author = CommitAuthor.objects.create(
            organization_id=org.id,
            name='Foo Bar',
            email=self.user.email,
        )
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message='fixes %s' % (group.qualified_short_id),
            key='alksdflskdfjsldkfajsflkslk',
            author=author,
        )

        old_release = self.create_release(project=project, version='pre-1.0')

        resolution = GroupResolution.objects.create(
            group=group,
            release=old_release,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )

        release = self.create_release(project=project, version='abcdabc')
        release.set_commits([{
            'id': commit.key,
            'repository': repo.name,
        }])

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        resolution = GroupResolution.objects.get(
            group=group,
        )
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.actor_id == self.user.id

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

    def test_resolution_support_without_author(self):
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

        release = self.create_release(project=project, version='abcdabc')
        release.set_commits([{
            'id': commit.key,
            'repository': repo.name,
        }])

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        resolution = GroupResolution.objects.get(
            group=group,
        )
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.actor_id is None

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

    @patch('sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound')
    def test_resolution_support_with_integration(self, mock_sync_status_outbound):
        org = self.create_organization()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org, self.user)

        OrganizationIntegration.objects.filter(
            integration_id=integration.id,
            organization_id=org.id,
        ).update(
            config={
                'sync_comments': True,
                'sync_status_outbound': True,
                'sync_status_inbound': True,
                'sync_assignee_outbound': True,
                'sync_assignee_inbound': True,
            }
        )
        project = self.create_project(organization=org, name='foo')
        group = self.create_group(project=project)

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=org.id,
            integration_id=integration.id,
            key='APP-%s' % group.id,
        )[0]

        GroupLink.objects.get_or_create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )[0]

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

        release = self.create_release(project=project, version='abcdabc')

        with self.tasks():
            with self.feature({
                'organizations:integrations-issue-sync': True,
                'organizations:internal-catchall': True,
            }):
                release.set_commits([{
                    'id': commit.key,
                    'repository': repo.name,
                }])

        mock_sync_status_outbound.assert_called_once_with(
            external_issue, True, group.project_id
        )

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        resolution = GroupResolution.objects.get(
            group=group,
        )
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.actor_id is None

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
