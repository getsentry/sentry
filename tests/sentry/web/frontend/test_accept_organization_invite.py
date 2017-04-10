from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuditLogEntry, AuditLogEntryEvent, OrganizationMember
from sentry.testutils import TestCase


class AcceptInviteTest(TestCase):
    def setUp(self):
        super(AcceptInviteTest, self).setUp()
        self.organization = self.create_organization(
            owner=self.create_user('foo@example.com'),
        )
        self.user = self.create_user('bar@example.com')

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
