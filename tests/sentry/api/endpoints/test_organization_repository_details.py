from __future__ import absolute_import

from mock import patch

from django.core.urlresolvers import reverse

from sentry.constants import ObjectStatus
from sentry.models import Commit, Integration, Repository
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

    @patch('sentry.api.endpoints.organization_repository_details.get_transaction_id')
    @patch('sentry.api.endpoints.organization_repository_details.delete_repository')
    def test_delete_disabled_no_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = '1'

        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
            status=ObjectStatus.DISABLED,
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
    def test_delete_disabled_with_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = '1'
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
            status=ObjectStatus.DISABLED,
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

    def test_put(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        integration = Integration.objects.create(
            provider='example',
            name='example',
        )
        integration.add_organization(org)

        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
            status=ObjectStatus.DISABLED,
        )

        url = reverse(
            'sentry-api-0-organization-repository-details', args=[
                org.slug,
                repo.id,
            ]
        )
        response = self.client.put(url, data={
            'status': 'visible',
            'integrationId': integration.id,
        })

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.VISIBLE
        assert repo.integration_id == integration.id
        assert repo.provider == 'integrations:example'

    def test_put_bad_integration_org(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        integration = Integration.objects.create(
            provider='example',
            name='example',
        )

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
        # integration isn't linked to org
        response = self.client.put(url, data={
            'status': 'visible',
            'integrationId': integration.id,
        })

        assert response.status_code == 400
        assert response.data['detail'] == 'Invalid integration id'

    def test_put_bad_integration_id(self):
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
        # integration isn't linked to org
        response = self.client.put(url, data={
            'status': 'visible',
            'integrationId': 'notanumber',
        })

        assert response.status_code == 400
        assert response.data == {'integrationId': ['Enter a whole number.']}
