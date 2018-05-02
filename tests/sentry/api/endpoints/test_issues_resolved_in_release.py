from __future__ import absolute_import

from django.core.urlresolvers import reverse
import six

from sentry.models import (
    Commit,
    GroupLink,
    GroupResolution,
    ReleaseCommit,
    Repository,
)

from sentry.testutils import APITestCase


class IssuesResolvedInReleaseEndpointTest(APITestCase):
    def setUp(self):
        super(IssuesResolvedInReleaseEndpointTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=self.user, teams=[self.team])
        self.project = self.create_project(
            teams=[self.team],
        )
        self.release = self.create_release(
            project=self.project,
        )
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)

        self.path = reverse(
            'sentry-api-0-release-resolved',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
                'version': self.release.version,
            }
        )

    def test_shows_issues_from_groupresolution(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupResolution model
        """
        GroupResolution.objects.create(
            group=self.group,
            release=self.release,
            type=GroupResolution.Type.in_release,
        )
        response = self.client.get(self.path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.group.id)

    def test_shows_issues_from_grouplink(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupLink model
        """
        repo = Repository.objects.create(
            organization_id=self.org.id,
            name=self.project.name,
        )
        commit = Commit.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key='a' * 40,
        )
        commit2 = Commit.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key='b' * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit2,
            order=0,
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )
        response = self.client.get(self.path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.group.id)

    def test_does_not_return_duplicate_groups(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from the GroupLink and GroupResolution model
        but will not return the groups twice if they appear in both
        """
        repo = Repository.objects.create(
            organization_id=self.org.id,
            name=self.project.name,
        )
        commit = Commit.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key='a' * 40,
        )
        commit2 = Commit.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key='b' * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit2,
            order=0,
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )
        GroupResolution.objects.create(
            group=self.group,
            release=self.release,
            type=GroupResolution.Type.in_release,
        )

        response = self.client.get(self.path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.group.id)

    def test_return_groups_from_both_types(self):
        """
        tests that the endpoint will correctly retrieve issues resolved
        in a release from both the GroupLink and GroupResolution model
        """
        group2 = self.create_group(project=self.project)
        repo = Repository.objects.create(
            organization_id=self.org.id,
            name=self.project.name,
        )
        commit = Commit.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key='a' * 40,
        )
        commit2 = Commit.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key='b' * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit2,
            order=0,
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )
        GroupResolution.objects.create(
            group=group2,
            release=self.release,
            type=GroupResolution.Type.in_release,
        )

        response = self.client.get(self.path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
