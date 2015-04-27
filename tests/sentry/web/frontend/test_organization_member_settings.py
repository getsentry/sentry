from __future__ import absolute_import

from django.core import mail
from django.core.urlresolvers import reverse

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
    OrganizationMemberTeam, OrganizationMemberType
)
from sentry.testutils import TestCase, PermissionTestCase


class OrganizationMemberSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationMemberSettingsPermissionTest, self).setUp()
        member = self.create_user()
        om = self.create_member(user=member, organization=self.organization)
        self.path = reverse('sentry-organization-member-settings', args=[self.organization.slug, om.id])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_org_admin_can_load(self):
        self.assert_org_admin_can_access(self.path)

    def test_org_member_cannot_load(self):
        self.assert_org_member_cannot_access(self.path)


class OrganizationMemberSettingsTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = self.create_member(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
            teams=[team_2],
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-member-settings.html')

        assert resp.context['organization'] == organization
        assert resp.context['member'] == member
        assert resp.context['form']

    def test_setting_global_access(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.post(path, {
            'has_global_access': True,
            'teams': [team_1.id, team_2.id],
            'type': OrganizationMemberType.ADMIN,
        })

        assert resp.status_code == 302

        member = OrganizationMember.objects.get(id=member.id)

        assert member.has_global_access is True
        assert member.type == OrganizationMemberType.ADMIN

        assert member.teams.count() == 2

        ale = AuditLogEntry.objects.get(
            organization=organization,
            event=AuditLogEntryEvent.MEMBER_EDIT,
        )

        assert ale.actor == self.user
        assert ale.target_object == member.id
        assert ale.target_user == user
        assert ale.data

    def test_setting_teams(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.post(path, {
            'teams': [team_1.id, team_2.id],
            'type': OrganizationMemberType.ADMIN,
        })

        assert resp.status_code == 302

        member = OrganizationMember.objects.get(id=member.id)

        assert member.has_global_access is False
        assert member.type == OrganizationMemberType.ADMIN

        teams = list(member.teams.all())
        assert team_1 in teams
        assert team_2 in teams
        assert len(teams) == 2

        ale = AuditLogEntry.objects.get(
            organization=organization,
            event=AuditLogEntryEvent.MEMBER_EDIT,
        )

        assert ale.actor == self.user
        assert ale.target_object == member.id
        assert ale.target_user == user
        assert ale.data

    def test_reinvite(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = OrganizationMember.objects.create(
            organization=organization,
            email='bar@example.com',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.post(path, {
            'op': 'reinvite',
            'teams': [team_1.id, team_2.id],
            'type': OrganizationMemberType.ADMIN,
        })

        assert resp.status_code == 302

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['bar@example.com']
        assert mail.outbox[0].subject == 'Invite to join organization: foo'

    def test_ensure_admin_cant_set_owner(self):
        organization = self.create_organization(name='foo', owner=self.user)

        admin = self.create_user('bar@example.com', is_superuser=False)
        user = self.create_user('baz@example.com')

        OrganizationMember.objects.create(
            organization=organization,
            user=admin,
            type=OrganizationMemberType.ADMIN,
            has_global_access=True,
        )

        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(admin)

        resp = self.client.post(path, {
            'type': OrganizationMemberType.OWNER,
        })

        assert resp.status_code == 200
        assert resp.context['form'].errors['type']

        resp = self.client.post(path, {
            'type': OrganizationMemberType.MEMBER,
        })

        assert resp.status_code == 302

    def test_cannot_edit_yourself(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        member = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-member-details.html')

        assert resp.context['organization'] == organization
        assert resp.context['member'] == member

    def test_cannot_edit_higher_access(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        member = self.create_user('foo@example.com', is_superuser=False)

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        member_om = OrganizationMember.objects.create(
            organization=organization,
            user=member,
            type=OrganizationMemberType.ADMIN,
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, owner_om.id])

        self.login_as(member)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-member-details.html')

        assert resp.context['organization'] == organization
        assert resp.context['member'] == owner_om

    def test_global_access_with_inactive_teams(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            type=OrganizationMemberType.MEMBER,
            has_global_access=True,
        )

        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team_1,
            is_active=False,
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.post(path, {
            'has_global_access': True,
            'type': OrganizationMemberType.MEMBER,
        })

        assert resp.status_code == 302

        member = OrganizationMember.objects.get(id=member.id)

        assert member.has_global_access is True
        assert member.type == OrganizationMemberType.MEMBER

        om_teams = OrganizationMemberTeam.objects.filter(
            organizationmember=member,
        )

        assert len(om_teams) == 1
        assert om_teams[0].is_active is False
        assert om_teams[0].team == team_1
