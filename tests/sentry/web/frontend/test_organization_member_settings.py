from __future__ import absolute_import

from django.core import mail
from django.core.urlresolvers import reverse

from sentry.models import AuditLogEntry, AuditLogEntryEvent, OrganizationMember
from sentry.testutils import TestCase, PermissionTestCase


class OrganizationMemberSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationMemberSettingsPermissionTest, self).setUp()
        member = self.create_user()
        om = self.create_member(user=member, organization=self.organization)
        self.path = reverse('sentry-organization-member-settings', args=[self.organization.slug, om.id])

    def test_non_member_cannot_load(self):
        self.assert_non_member_cannot_access(self.path)

    def test_member_can_load(self):
        self.assert_member_can_access(self.path)


class OrganizationMemberSettingsTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = self.create_member(
            organization=organization,
            user=user,
            role='member',
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

    def test_setting_role(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        user = self.create_user('bar@example.com')
        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            role='member',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.post(path, {
            'teams': [team_1.id, team_2.id],
            'role': 'admin',
        })

        assert resp.status_code == 302

        member = OrganizationMember.objects.get(id=member.id)

        assert member.role == 'admin'

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
            role='member',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        resp = self.client.post(path, {
            'teams': [team_1.id, team_2.id],
            'role': 'member',
        })

        assert resp.status_code == 302, resp.context['form'].errors

        member = OrganizationMember.objects.get(id=member.id)
        assert member.role == 'member'

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

        member = OrganizationMember.objects.create(
            organization=organization,
            email='bar@example.com',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member.id])

        self.login_as(self.user)

        with self.tasks():
            resp = self.client.post(path, {
                'op': 'reinvite',
            })

        assert resp.status_code == 302

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['bar@example.com']
        assert mail.outbox[0].subject == 'Join foo in using Sentry'

    def test_cannot_edit_yourself(self):
        organization = self.create_organization(name='foo', owner=self.user)
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

    def test_admin_cant_edit(self):
        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('foo@example.com', is_superuser=False)
        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        OrganizationMember.objects.create(
            organization=organization,
            user=member,
            role='admin',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, owner_om.id])

        self.login_as(member)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-member-details.html')

        assert resp.context['organization'] == organization
        assert resp.context['member'] == owner_om

    def test_member_cant_edit(self):
        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('foo@example.com', is_superuser=False)
        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        OrganizationMember.objects.create(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, owner_om.id])

        self.login_as(member)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-member-details.html')

        assert resp.context['organization'] == organization
        assert resp.context['member'] == owner_om

    def test_manager_cant_assign_owner(self):
        organization = self.create_organization(name='foo', owner=self.user)

        manager = self.create_user('bar@example.com')
        OrganizationMember.objects.create(
            organization=organization,
            user=manager,
            role='manager',
        )

        member = self.create_user('baz@example.com')
        member_om = OrganizationMember.objects.create(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member_om.id])

        self.login_as(manager)

        resp = self.client.post(path, {
            'role': 'owner',
        })

        assert resp.status_code == 200

        member = OrganizationMember.objects.get(id=member_om.id)

        assert member.role == 'member'

    def test_manager_cant_downgrade_owner(self):
        organization = self.create_organization(name='foo', owner=self.user)

        manager = self.create_user('bar@example.com')
        OrganizationMember.objects.create(
            organization=organization,
            user=manager,
            role='manager',
        )

        member = self.create_user('baz@example.com')
        member_om = OrganizationMember.objects.create(
            organization=organization,
            user=member,
            role='owner',
        )

        path = reverse('sentry-organization-member-settings',
                       args=[organization.slug, member_om.id])

        self.login_as(manager)

        resp = self.client.post(path, {
            'role': 'manager',
        })

        assert resp.status_code == 200

        member = OrganizationMember.objects.get(id=member_om.id)

        assert member.role == 'owner'
