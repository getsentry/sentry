from __future__ import absolute_import

from django.core import mail
from django.core.urlresolvers import reverse

from sentry.models import OrganizationMember, OrganizationMemberTeam
from sentry.testutils import PermissionTestCase, TestCase


class CreateOrganizationMemberPermissionTest(PermissionTestCase):
    def setUp(self):
        super(CreateOrganizationMemberPermissionTest, self).setUp()
        self.path = reverse('sentry-create-organization-member', args=[self.organization.slug])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)

    def test_member_cannot_load(self):
        self.assert_member_cannot_access(self.path)


class CreateOrganizationMemberTest(TestCase):
    def test_renders_with_team_preselected(self):
        # If org has just one team, it is selected by default
        organization = self.create_organization()
        team = self.create_team(name='foo', organization=organization)
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-organization-member.html')
        assert resp.context['organization'] == organization
        assert resp.context['form']
        assert resp.context['form'].initial['teams'][0] == team

    def test_renders_no_teams_seleced(self):
        # With multiple teams, *no* teams are selected by default
        organization = self.create_organization()
        self.create_team(name='one', organization=organization)
        self.create_team(name='two', organization=organization)
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-organization-member.html')
        assert resp.context['organization'] == organization
        assert resp.context['form']
        assert len(resp.context['form'].initial['teams']) == 0

    def test_valid_for_invites(self):
        organization = self.create_organization(name='Default')
        team = self.create_team(name='foo', organization=organization)

        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            resp = self.client.post(path, {
                'email': 'foo@example.com',
                'role': 'admin',
                'teams': [team.id, ]
            })
        assert resp.status_code == 302

        member = OrganizationMember.objects.get(
            organization=organization,
            email='foo@example.com',
        )

        assert member.user is None
        assert member.role == 'admin'

        om_teams = OrganizationMemberTeam.objects.filter(
            organizationmember=member
        )

        assert len(om_teams) == 1
        assert om_teams[0].team_id == team.id

        redirect_uri = reverse('sentry-organization-members', args=[organization.slug])
        assert resp['Location'] == 'http://testserver' + redirect_uri

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['foo@example.com']
        assert mail.outbox[0].subject == 'Join Default in using Sentry'

    def test_existing_user_for_invite(self):
        organization = self.create_organization()
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        user = self.create_user('foo@example.com')

        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            role='member',
        )

        with self.settings(SENTRY_ENABLE_INVITES=True):
            resp = self.client.post(path, {
                'email': 'foo@example.com',
                'role': 'member'
            })

        assert resp.status_code == 302

        member = OrganizationMember.objects.get(id=member.id)

        assert member.email is None
        assert member.role == 'member'

        redirect_uri = reverse('sentry-organization-members', args=[organization.slug])
        assert resp['Location'] == 'http://testserver' + redirect_uri

    def test_valid_for_direct_add(self):
        organization = self.create_organization()
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        user = self.create_user('foo@example.com')

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(path, {
                'user': 'foo@example.com',
                'role': 'admin'
            })
        assert resp.status_code == 302

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert member.email is None
        assert member.role == 'admin'

        redirect_uri = reverse('sentry-organization-members', args=[organization.slug])
        assert resp['Location'] == 'http://testserver' + redirect_uri

    def test_invalid_user_for_direct_add(self):
        organization = self.create_organization()
        path = reverse('sentry-create-organization-member', args=[organization.slug])
        self.login_as(self.user)

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(path, {
                'user': 'bar@example.com',
                'role': 'member'
            })

        assert resp.status_code == 200
        assert 'user' in resp.context['form'].errors
