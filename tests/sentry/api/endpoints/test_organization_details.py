from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import (
    OrganizationMemberType, Organization, OrganizationStatus
)
from sentry.testutils import APITestCase


class OrganizationDetailsTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data['id'] == str(org.id)


class OrganizationUpdateTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })
        response = self.client.put(url, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert response.status_code == 200, response.content
        org = Organization.objects.get(id=org.id)
        assert org.name == 'hello world'
        assert org.slug == 'foobar'


class OrganizationDeleteTest(APITestCase):
    @patch('sentry.api.endpoints.organization_details.delete_organization')
    def test_as_owner(self, mock_delete_organization):
        org = self.create_organization()

        user = self.create_user(email='foo@example.com', is_superuser=False)

        org.member_set.create(
            user=user,
            has_global_access=True,
            type=OrganizationMemberType.OWNER,
        )

        self.login_as(user)

        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })

        response = self.client.delete(url)

        org = Organization.objects.get(id=org.id)

        assert response.status_code == 204, response.data

        assert org.status == OrganizationStatus.PENDING_DELETION

        mock_delete_organization.delay.assert_called_once_with(
            object_id=org.id,
            countdown=60 * 5,
        )

    def test_as_admin(self):
        org = self.create_organization(owner=self.user)

        user = self.create_user(email='foo@example.com', is_superuser=False)

        org.member_set.create_or_update(
            organization=org,
            user=user,
            values={
                'type': OrganizationMemberType.ADMIN,
            }
        )

        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })
        response = self.client.delete(url)

        assert response.status_code == 403

    def test_cannot_remove_default(self):
        Organization.objects.all().delete()

        org = self.create_organization(owner=self.user)

        self.login_as(self.user)

        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })

        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            response = self.client.delete(url)

        assert response.status_code == 400, response.data
