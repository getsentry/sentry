from __future__ import absolute_import

from mock import patch

from django.core.urlresolvers import reverse

from sentry.constants import ObjectStatus
from sentry.models import Commit, Repository
from sentry.testutils import APITestCase


class OrganizationRepositoryDeleteTest(APITestCase):
    @patch('sentry.api.endpoints.organization_repository_details.get_transaction_id')
    @patch('sentry.api.endpoints.organization_repository_details.delete_repository')
    def test_delete_no_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = '1'

        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
        )

        url = reverse(
            'sentry-api-0-organization-repository-details', args=[
                org.slug,
                repo.id,
            ]
        )
        response = self.client.delete(url)
        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        mock_delete_repository.apply_async.assert_called_with(
            kwargs={
                'object_id': repo.id,
                'transaction_id': '1',
                'actor_id': self.user.id,
            },
            countdown=0,
        )

    @patch('sentry.api.endpoints.organization_repository_details.get_transaction_id')
    @patch('sentry.api.endpoints.organization_repository_details.delete_repository')
    def test_delete_with_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = '1'
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

        url = reverse(
            'sentry-api-0-organization-repository-details', args=[
                org.slug,
                repo.id,
            ]
        )
        response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION
        mock_delete_repository.apply_async.assert_called_with(
            kwargs={
                'object_id': repo.id,
                'transaction_id': '1',
                'actor_id': self.user.id,
            },
            countdown=3600,
        )
