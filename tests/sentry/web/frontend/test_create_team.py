from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationMember, OrganizationMemberTeam, Team
from sentry.testutils import TestCase, PermissionTestCase


class CreateTeamPermissionTest(PermissionTestCase):
    def setUp(self):
        super(CreateTeamPermissionTest, self).setUp()
        self.path = reverse('sentry-create-team', args=[self.organization.slug])

    def test_teamless_admin_can_load(self):
        self.assert_teamless_admin_can_access(self.path)

    def test_team_admin_can_load(self):
        self.assert_team_admin_can_access(self.path)

    def test_member_cannot_load(self):
        self.assert_member_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class CreateTeamTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-team.html')
        assert resp.context['organization'] == organization
        assert resp.context['form']

    def test_submission(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.post(path, {
            'name': 'bar',
        })
        assert resp.status_code == 302, resp.context['form'].errors

        team = Team.objects.get(organization=organization, name='bar')

        member = OrganizationMember.objects.get(
            user=self.user,
            organization=organization,
        )

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=team,
            is_active=True,
        ).exists()

        redirect_uri = reverse('sentry-create-project', args=[organization.slug])
        assert resp['Location'] == 'http://testserver%s?team=%s' % (
            redirect_uri, team.slug)

    def test_admin_can_create_team(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])

        admin = self.create_user('admin@example.com')
        self.create_member(
            organization=organization,
            user=admin,
            role='admin',
            teams=[],
        )

        self.login_as(admin)

        resp = self.client.post(path, {
            'name': 'bar',
        })
        assert resp.status_code == 302, resp.context['form'].errors

        assert Team.objects.filter(
            organization=organization,
            name='bar',
        ).exists()
