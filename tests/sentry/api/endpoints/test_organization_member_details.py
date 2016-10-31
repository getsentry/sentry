from __future__ import absolute_import

from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import (
    AuthProvider, OrganizationMember
)
from sentry.testutils import APITestCase


class UpdateOrganizationMemberTest(APITestCase):
    @patch('sentry.models.OrganizationMember.send_invite_email')
    def test_reinvite_pending_member(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member_om = self.create_member(
            organization=organization,
            email='foo@example.com',
            role='member',
        )

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, member_om.id])

        self.login_as(self.user)

        resp = self.client.put(path, data={'reinvite': 1})

        assert resp.status_code == 204
        mock_send_invite_email.assert_called_once_with()

    @patch('sentry.models.OrganizationMember.send_sso_link_email')
    def test_reinvite_sso_link(self, mock_send_sso_link_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('bar@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
        )
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
            flags=1,
        )

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, member_om.id])

        self.login_as(self.user)

        resp = self.client.put(path, data={'reinvite': 1})

        assert resp.status_code == 204
        mock_send_sso_link_email.assert_called_once_with()

    @patch('sentry.models.OrganizationMember.send_sso_link_email')
    def test_cannot_reinvite_normal_member(self, mock_send_sso_link_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('bar@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, member_om.id])

        self.login_as(self.user)

        resp = self.client.put(path, data={'reinvite': 1})

        assert resp.status_code == 400


class DeleteOrganizationMemberTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('bar@example.com')

        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, member_om.id])

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 204

        assert not OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_cannot_delete_member_with_higher_access(self):
        organization = self.create_organization(name='foo', owner=self.user)

        other_user = self.create_user('bar@example.com')

        self.create_member(
            organization=organization,
            role='manager',
            user=other_user,
        )

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        assert owner_om.role == 'owner'

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, owner_om.id])

        self.login_as(other_user)

        resp = self.client.delete(path)

        assert resp.status_code == 400

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_cannot_delete_only_owner(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        # create a pending member, which shouldn't be counted in the checks
        self.create_member(
            organization=organization,
            role='owner',
            email='bar@example.com',
        )

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        assert owner_om.role == 'owner'

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, owner_om.id])

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 403

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_can_delete_self(self):
        organization = self.create_organization(name='foo', owner=self.user)

        other_user = self.create_user('bar@example.com')

        self.create_member(
            organization=organization,
            role='member',
            user=other_user,
        )

        path = reverse('sentry-api-0-organization-member-details', args=[organization.slug, 'me'])

        self.login_as(other_user)

        resp = self.client.delete(path)

        assert resp.status_code == 204

        assert not OrganizationMember.objects.filter(
            user=other_user,
            organization=organization,
        ).exists()

    def test_missing_scope(self):
        organization = self.create_organization(name='foo', owner=self.user)

        admin_user = self.create_user('bar@example.com')

        self.create_member(
            organization=organization,
            role='admin',
            user=admin_user,
        )

        member_user = self.create_user('baz@example.com')

        member_om = self.create_member(
            organization=organization,
            role='member',
            user=member_user,
        )

        path = reverse('sentry-api-0-organization-member-details', args=[
            organization.slug, member_om.id,
        ])

        self.login_as(admin_user)

        resp = self.client.delete(path)

        assert resp.status_code == 400

        assert OrganizationMember.objects.filter(id=member_om.id).exists()
