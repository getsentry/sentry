from __future__ import absolute_import

import six

from base64 import b64encode
from django.core.urlresolvers import reverse
from django.core import mail
from mock import patch

from sentry.models import (Organization, OrganizationAvatar, OrganizationOption, OrganizationStatus)
from sentry.signals import project_created
from sentry.testutils import APITestCase


class OrganizationDetailsTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.get(url, format='json')
        assert response.data['onboardingTasks'] == []
        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(org.id)

        project = self.create_project(organization=org)
        project_created.send(project=project, user=self.user, sender=type(project))

        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.get(url, format='json')
        assert len(response.data['onboardingTasks']) == 1
        assert response.data['onboardingTasks'][0]['task'] == 1


class OrganizationUpdateTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'name': 'hello world',
                'slug': 'foobar',
            }
        )
        assert response.status_code == 200, response.content
        org = Organization.objects.get(id=org.id)
        assert org.name == 'hello world'
        assert org.slug == 'foobar'

    def test_dupe_slug(self):
        org = self.create_organization(owner=self.user)
        org2 = self.create_organization(owner=self.user, slug='baz')
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'slug': org2.slug,
            }
        )
        assert response.status_code == 400, response.content

    def test_setting_rate_limit(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'projectRateLimit': '80',
            }
        )
        assert response.status_code == 200, response.content
        result = OrganizationOption.objects.get_value(org, 'sentry:project-rate-limit')
        assert result == 80

    def test_upload_avatar(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url,
            data={
                'avatarType': 'upload',
                'avatar': b64encode(self.load_fixture('avatar.jpg')),
            },
            format='json'
        )

        avatar = OrganizationAvatar.objects.get(
            organization=org,
        )
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == 'upload'
        assert avatar.file

    def test_various_options(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url,
            data={
                'openMembership': False,
                'isEarlyAdopter': True,
                'allowSharedIssues': False,
                'enhancedPrivacy': True,
                'dataScrubber': True,
                'dataScrubberDefaults': True,
                'sensitiveFields': ['password'],
                'safeFields': ['email'],
                'scrubIPAddresses': True,
                'defaultRole': 'owner',
            }
        )
        assert response.status_code == 200, response.content
        org = Organization.objects.get(id=org.id)

        assert org.flags.early_adopter
        assert not org.flags.allow_joinleave
        assert org.flags.disable_shared_issues
        assert org.flags.enhanced_privacy
        assert org.flags.enhanced_privacy
        assert org.default_role == 'owner'

        options = {o.key: o.value for o in OrganizationOption.objects.filter(
            organization=org,
        )}

        assert options.get('sentry:require_scrub_defaults')
        assert options.get('sentry:require_scrub_data')
        assert options.get('sentry:require_scrub_ip_address')
        assert options.get('sentry:sensitive_fields') == ['password']
        assert options.get('sentry:safe_fields') == ['email']

    def test_safe_fields_as_string_regression(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'safeFields': 'email',
            }
        )
        assert response.status_code == 400, (response.status_code, response.content)
        org = Organization.objects.get(id=org.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(
            organization=org,
        )}

        assert not options.get('sentry:safe_fields')

    def test_manager_cannot_set_default_role(self):
        org = self.create_organization(owner=self.user)
        user = self.create_user('baz@example.com')
        self.create_member(organization=org, user=user, role='manager')
        self.login_as(user=user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'defaultRole': 'owner',
            }
        )
        assert response.status_code == 200, response.content
        org = Organization.objects.get(id=org.id)

        assert org.default_role == 'member'

    def test_empty_string_in_array_safe_fields(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'safeFields': [''],
            }
        )
        assert response.status_code == 400, (response.status_code, response.content)
        org = Organization.objects.get(id=org.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(
            organization=org,
        )}

        assert not options.get('sentry:safe_fields')

    def test_empty_string_in_array_sensitive_fields(self):
        org = self.create_organization(owner=self.user)
        OrganizationOption.objects.set_value(
            org,
            'sentry:sensitive_fields',
            ['foobar'],
        )
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'sensitiveFields': [''],
            }
        )
        assert response.status_code == 400, (response.status_code, response.content)
        org = Organization.objects.get(id=org.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(
            organization=org,
        )}

        assert options.get('sentry:sensitive_fields') == ['foobar']

    def test_empty_sensitive_fields(self):
        org = self.create_organization(owner=self.user)
        OrganizationOption.objects.set_value(
            org,
            'sentry:sensitive_fields',
            ['foobar'],
        )
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.put(
            url, data={
                'sensitiveFields': [],
            }
        )
        assert response.status_code == 200, (response.status_code, response.content)
        org = Organization.objects.get(id=org.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(
            organization=org,
        )}

        assert not options.get('sentry:sensitive_fields')


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

        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )

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
                'actor_id': user.id,
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

        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.delete(url)

        assert response.status_code == 403

    def test_cannot_remove_default(self):
        Organization.objects.all().delete()

        org = self.create_organization(owner=self.user)

        self.login_as(self.user)

        url = reverse(
            'sentry-api-0-organization-details', kwargs={
                'organization_slug': org.slug,
            }
        )

        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            response = self.client.delete(url)

        assert response.status_code == 400, response.data
