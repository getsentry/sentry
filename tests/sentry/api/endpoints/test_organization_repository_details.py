from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.constants import ObjectStatus
from sentry.models import Commit, Repository
from sentry.testutils import APITestCase


class OrganizationRepositoryDeleteTest(APITestCase):
    def test_delete_no_commits(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
        )

        url = reverse('sentry-api-0-organization-repository-details', args=[
            org.slug, repo.id,
        ])
        response = self.client.delete(url)

        assert response.status_code == 204
        assert not response.content

        assert not Repository.objects.filter(id=repo.id).exists()

    def test_delete_with_commits(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
        )
        Commit.objects.create(
            repository_id=repo.id,
            key='a' * 40,
            organization_id=org.id,
        )

        url = reverse('sentry-api-0-organization-repository-details', args=[
            org.slug, repo.id,
        ])
        response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION
