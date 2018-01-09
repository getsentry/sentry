from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import Authenticator, Organization, OrganizationStatus, TotpInterface
from sentry.testutils import APITestCase


class OrganizationsListTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-organizations')

    def test_membership(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        response = self.client.get('{}?member=1'.format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(org.id)

    def test_status_query(self):
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)
        self.login_as(user=self.user)
        response = self.client.get('{}?query=status:pending_deletion'.format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(org.id)
        response = self.client.get('{}?query=status:deletion_in_progress'.format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0
        response = self.client.get('{}?query=status:invalid_status'.format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0


class OrganizationsCreateTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-organizations')

    def test_missing_params(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 400

    def test_valid_params(self):
        self.login_as(user=self.user)

        resp = self.client.post(
            self.path, data={
                'name': 'hello world',
                'slug': 'foobar',
            }
        )
        assert resp.status_code == 201, resp.content
        org = Organization.objects.get(id=resp.data['id'])
        assert org.name == 'hello world'
        assert org.slug == 'foobar'

        resp = self.client.post(
            self.path, data={
                'name': 'hello world',
                'slug': 'foobar',
            }
        )
        assert resp.status_code == 409, resp.content

    def test_without_slug(self):
        self.login_as(user=self.user)

        resp = self.client.post(
            self.path, data={
                'name': 'hello world',
            }
        )
        assert resp.status_code == 201, resp.content
        org = Organization.objects.get(id=resp.data['id'])
        assert org.slug == 'hello-world'


class OrganizationIndex2faTest(APITestCase):

    def test_preexisting_members_must_enable_2fa(self):
        organization = self.create_organization(owner=self.create_user())
        user = self.create_user()
        self.create_member(organization=organization, user=user, role="member")
        self.login_as(user)

        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': organization.slug,
        })

        response = self.client.get(url)
        assert response.status_code == 200

        organization.flags.require_2fa = True
        organization.save()

        response = self.client.get(url)
        assert response.status_code == 401

        TotpInterface().enroll(user)

        response = self.client.get(url)
        assert response.status_code == 200

    def test_new_member_must_enable_2fa(self):
        organization = self.create_organization(owner=self.create_user())
        organization.flags.require_2fa = True
        organization.save()

        user = self.create_user()
        self.create_member(organization=organization, user=user, role="member")

        self.login_as(user)
        url = reverse('sentry-organization-home', kwargs={
            'organization_slug': organization.slug,
        })
        response = self.client.get(url)
        assert response.status_code == 302
        assert reverse('sentry-account-settings-2fa') in response.url

        TotpInterface().enroll(user)

        response = self.client.get(url)
        assert response.status_code == 200

    def test_member_disable_all_2fa_blocked(self):
        organization = self.create_organization(owner=self.create_user())
        organization.flags.require_2fa = True
        organization.save()

        user = self.create_user()
        self.create_member(organization=organization, user=user, role="member")
        TotpInterface().enroll(user)

        self.login_as(user)
        url = reverse('sentry-organization-home', kwargs={
            'organization_slug': organization.slug,
        })
        response = self.client.get(url)
        assert response.status_code == 200

        # delete the user's 2fa
        Authenticator.objects.get(user=user).delete()

        response = self.client.get(url)

        assert response.status_code == 302
        assert reverse('sentry-account-settings-2fa') in response.url
