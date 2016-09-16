from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from django.core import mail
from mock import patch

from sentry.models import Organization, OrganizationOption, OrganizationStatus
from sentry.signals import project_created
from sentry.testutils import APITestCase


class OrganizationDetailsTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })
        response = self.client.get(url, format='json')
        assert response.data['onboardingTasks'] == []
        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(org.id)

        project = self.create_project(organization=org)
        project_created.send(project=project, user=self.user, sender=type(project))

        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })
        response = self.client.get(url, format='json')
        assert len(response.data['onboardingTasks']) == 1
        assert response.data['onboardingTasks'][0]['task'] == 1


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

    def test_setting_rate_limit(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })
        response = self.client.put(url, data={
            'projectRateLimit': '80',
        })
        assert response.status_code == 200, response.content
        result = OrganizationOption.objects.get_value(
            org, 'sentry:project-rate-limit')
        assert result == 80


class OrganizationDeleteTest(APITestCase):
    @patch('sentry.api.endpoints.organization_details.uuid4')
    @patch('sentry.api.endpoints.organization_details.delete_organization')
    def test_can_remove_as_owner(self, mock_delete_organization, mock_uuid4):
        class uuid(object):
            hex = 'abc123'

        mock_uuid4.return_value = uuid

        org = self.create_organization()

        user = self.create_user(email='foo@example.com', is_superuser=False)

        self.create_member(
            organization=org,
            user=user,
            role='owner',
        )

        self.login_as(user)

        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })

        owners = org.get_owners()
        assert len(owners) > 0

        with self.tasks():
            response = self.client.delete(url)

        org = Organization.objects.get(id=org.id)

        assert response.status_code == 204, response.data

        assert org.status == OrganizationStatus.PENDING_DELETION

        mock_delete_organization.apply_async.assert_called_once_with(
            kwargs={
                'object_id': org.id,
                'transaction_id': 'abc123',
            },
            countdown=86400,
        )

        # Make sure we've emailed all owners
        assert len(mail.outbox) == len(owners)
        owner_emails = set(o.email for o in owners)
        for msg in mail.outbox:
            assert 'Deletion' in msg.subject
            assert len(msg.to) == 1
            owner_emails.remove(msg.to[0])
        # No owners should be remaining
        assert len(owner_emails) == 0

    def test_cannot_remove_as_admin(self):
        org = self.create_organization(owner=self.user)

        user = self.create_user(email='foo@example.com', is_superuser=False)

        self.create_member(
            organization=org,
            user=user,
            role='admin',
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
