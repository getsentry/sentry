from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.db.models import F

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Authenticator,
    Organization, OrganizationMember, TotpInterface
)
from sentry.testutils import TestCase


class AcceptInviteTest(TestCase):
    def setUp(self):
        super(AcceptInviteTest, self).setUp()
        self.organization = self.create_organization(
            owner=self.create_user('foo@example.com'),
        )
        self.user = self.create_user('bar@example.com')

    def _require_2fa_for_organization(self):
        self.organization.update(flags=F('flags').bitor(Organization.flags.require_2fa))
        self.assertTrue(self.organization.flags.require_2fa.is_set)

    def _enroll_user_in_2fa(self):
        interface = TotpInterface()
        interface.enroll(self.user)
        self.assertTrue(Authenticator.objects.user_has_2fa(self.user))

    def _assert_2fa_cookie_set(self, response, om):
        invite_link = om.get_invite_link()
        self.assertIn(response.client.cookies['pending-invite'].value, invite_link)

    def _assert_2fa_cookie_not_set(self, response):
        self.assertNotIn('pending-invite', response.client.cookies)

    def test_invalid_member_id(self):
        resp = self.client.get(reverse('sentry-accept-invite', args=[1, 2]))
        assert resp.status_code == 302

    def test_invalid_token(self):
        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[om.id, 2]))
        assert resp.status_code == 302

    def test_renders_unauthenticated_template(self):
        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/accept-organization-invite.html')
        assert resp.context['needs_authentication']

    def test_renders_authenticated_template(self):
        self.login_as(self.user)

        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/accept-organization-invite.html')
        assert not resp.context['needs_authentication']

    def test_renders_user_eeds_2fa_template(self):
        self._require_2fa_for_organization()
        self.assertFalse(Authenticator.objects.user_has_2fa(self.user))

        self.login_as(self.user)

        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/accept-organization-invite.html')
        assert resp.context['needs_2fa']

        self._assert_2fa_cookie_set(resp, om)

    def test_renders_user_has_2fa_template(self):
        self._require_2fa_for_organization()
        self._enroll_user_in_2fa()

        self.login_as(self.user)

        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/accept-organization-invite.html')
        assert not resp.context['needs_2fa']

        self._assert_2fa_cookie_not_set(resp)

    def test_can_accept_while_authenticated(self):
        self.login_as(self.user)

        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            role='member',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.post(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 302

        om = OrganizationMember.objects.get(id=om.id)
        assert om.email is None
        assert om.user == self.user

        ale = AuditLogEntry.objects.get(
            organization=self.organization,
            event=AuditLogEntryEvent.MEMBER_ACCEPT,
        )

        assert ale.actor == self.user
        assert ale.target_object == om.id
        assert ale.target_user == self.user
        assert ale.data

    def test_cannot_accept_while_unauthenticated(self):
        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            role='member',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.post(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/accept-organization-invite.html')

    def test_can_accept_when_user_has_2fa(self):
        self._require_2fa_for_organization()
        self._enroll_user_in_2fa()

        self.login_as(self.user)

        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            role='member',
            token='abc',
            organization=self.organization,
        )

        resp = self.client.post(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 302

        self._assert_2fa_cookie_not_set(resp)

        om = OrganizationMember.objects.get(id=om.id)
        assert om.email is None
        assert om.user == self.user

        ale = AuditLogEntry.objects.get(
            organization=self.organization,
            event=AuditLogEntryEvent.MEMBER_ACCEPT,
        )

        assert ale.actor == self.user
        assert ale.target_object == om.id
        assert ale.target_user == self.user
        assert ale.data

    def test_cannot_accept_when_user_needs_2fa(self):
        self._require_2fa_for_organization()
        self.assertFalse(Authenticator.objects.user_has_2fa(self.user))

        self.login_as(self.user)

        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            role='member',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.post(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/accept-organization-invite.html')

        self._assert_2fa_cookie_set(resp, om)

    def test_2fa_cookie_deleted_afer_accept(self):
        self._require_2fa_for_organization()
        self.assertFalse(Authenticator.objects.user_has_2fa(self.user))

        self.login_as(self.user)

        om = OrganizationMember.objects.create(
            email='newuser@example.com',
            role='member',
            token='abc',
            organization=self.organization,
        )
        resp = self.client.post(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/accept-organization-invite.html')
        self._assert_2fa_cookie_set(resp, om)

        self._enroll_user_in_2fa()
        resp = self.client.post(reverse('sentry-accept-invite', args=[om.id, om.token]))
        assert resp.status_code == 302

        # value set to empty string on deletion
        self.assertFalse(resp.client.cookies['pending-invite'].value)
