from __future__ import absolute_import

from django.core import mail
from django.core.urlresolvers import reverse

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.testutils import TestCase


class CreateOrganizationMemberTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization()
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-organization-member.html')
        assert resp.context['organization'] == organization
        assert resp.context['form']

    def test_valid_for_invites(self):
        organization = self.create_organization(name='Default')
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        with self.settings(SENTRY_ENABLE_INVITES=True):
            resp = self.client.post(path, {
                'type': OrganizationMemberType.MEMBER,
                'email': 'foo@example.com',
            })
        assert resp.status_code == 302

        member = OrganizationMember.objects.get(
            organization=organization,
            email='foo@example.com',
        )

        assert member.type == OrganizationMemberType.MEMBER
        assert member.user is None

        redirect_uri = reverse('sentry-organization-member-settings', args=[organization.slug, member.id])
        assert resp['Location'] == 'http://testserver' + redirect_uri

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['foo@example.com']
        assert mail.outbox[0].subject == 'Invite to join organization: Default'

    def test_existing_user_for_invite(self):
        organization = self.create_organization()
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        user = self.create_user('foo@example.com')

        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
        )

        with self.settings(SENTRY_ENABLE_INVITES=True):
            resp = self.client.post(path, {
                'type': OrganizationMemberType.ADMIN,
                'email': 'foo@example.com',
            })

        assert resp.status_code == 302

        member = OrganizationMember.objects.get(id=member.id)

        assert member.type == OrganizationMemberType.MEMBER
        assert member.email is None

        redirect_uri = reverse('sentry-organization-member-settings', args=[organization.slug, member.id])
        assert resp['Location'] == 'http://testserver' + redirect_uri

    def test_valid_for_direct_add(self):
        organization = self.create_organization()
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        user = self.create_user('foo@example.com')

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(path, {
                'type': OrganizationMemberType.MEMBER,
                'user': 'foo@example.com',
            })
        assert resp.status_code == 302

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert member.type == OrganizationMemberType.MEMBER
        assert member.email is None

        redirect_uri = reverse('sentry-organization-member-settings', args=[organization.slug, member.id])
        assert resp['Location'] == 'http://testserver' + redirect_uri

    def test_invalid_user_for_direct_add(self):
        organization = self.create_organization()
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(path, {
                'type': OrganizationMemberType.MEMBER,
                'user': 'bar@example.com',
            })

        assert resp.status_code == 200
        assert 'user' in resp.context['form'].errors
