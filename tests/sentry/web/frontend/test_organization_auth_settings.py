from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase, PermissionTestCase


class OrganizationAuthSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationAuthSettingsPermissionTest, self).setUp()
        self.path = reverse('sentry-organization-auth-settings', args=[self.organization.slug])

    def test_teamless_owner_cannot_load(self):
        self.assert_teamless_owner_cannot_access(self.path)

    def test_org_admin_cannot_load(self):
        self.assert_org_admin_cannot_access(self.path)

    def test_org_owner_can_load(self):
        self.assert_org_owner_can_access(self.path)


class OrganizationAuthSettingsTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team = self.create_team(organization=organization)
        project = self.create_project(team=team)

        path = reverse('sentry-organization-auth-settings', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-auth-settings.html')

        assert resp.context['organization'] == organization
        assert resp.context['provider_list']

    def test_can_start_auth_flow(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team = self.create_team(organization=organization)
        project = self.create_project(team=team)

        path = reverse('sentry-organization-auth-settings', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.post(path, {'provider': 'google'})

        assert resp.status_code == 302
