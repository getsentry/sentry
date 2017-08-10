from __future__ import absolute_import

from django.core.urlresolvers import reverse
import six

from sentry.models import (
    Commit,
    GroupCommitResolution,
    GroupResolution,
    Release,
    ReleaseCommit,
    Repository,
)

from sentry.testutils import APITestCase


class IssuesResolvedInReleaseEndpointTest(APITestCase):
    def test_shows_issues_from_groupresolution(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupResolution model
        """
        user = self.create_user('foo@example.com', is_superuser=True)
        project = self.create_project(
            name='foo',
        )
        self.login_as(user)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        group = self.create_group(project=project)
        GroupResolution.objects.create(
            group=group,
            release=release,
            type=GroupResolution.Type.in_release,
        )
        url = reverse(
            'sentry-api-0-release-resolved',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group.id)

    def test_shows_issues_from_groupcommitresolution(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupCommitResolution model
        """
        user = self.create_user('foo@example.com', is_superuser=True)
        project = self.create_project(
            name='foo',
        )
        self.login_as(user)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        group = self.create_group(project=project)
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=project.name,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='a' * 40,
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='b' * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release,
            commit=commit2,
            order=0,
        )
        GroupCommitResolution.objects.create(group_id=group.id, commit_id=commit.id)
        url = reverse(
            'sentry-api-0-release-resolved',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group.id)

    def test_does_not_return_duplicate_groups(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupCommitResolution and GroupResolution model
        but will not return the groups twice if they appear in both
        """
        user = self.create_user('foo@example.com', is_superuser=True)
        project = self.create_project(
            name='foo',
        )
        self.login_as(user)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        group = self.create_group(project=project)
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=project.name,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='a' * 40,
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='b' * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release,
            commit=commit2,
            order=0,
        )
        GroupCommitResolution.objects.create(group_id=group.id, commit_id=commit.id)
        GroupResolution.objects.create(
            group=group,
            release=release,
            type=GroupResolution.Type.in_release,
        )
        url = reverse(
            'sentry-api-0-release-resolved',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(group.id)

    def test_return_groups_from_both_types(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from both the GroupCommitResolution and GroupResolution model
        """
        user = self.create_user('foo@example.com', is_superuser=True)
        project = self.create_project(
            name='foo',
        )
        self.login_as(user)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        group = self.create_group(project=project)
        group2 = self.create_group(project=project)
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=project.name,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='a' * 40,
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='b' * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release,
            commit=commit2,
            order=0,
        )
        GroupCommitResolution.objects.create(group_id=group.id, commit_id=commit.id)
        GroupResolution.objects.create(
            group=group2,
            release=release,
            type=GroupResolution.Type.in_release,
        )
        url = reverse(
            'sentry-api-0-release-resolved',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
