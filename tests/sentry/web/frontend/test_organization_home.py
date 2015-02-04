from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase, PermissionTestCase


class OrganizationHomePermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationHomePermissionTest, self).setUp()
        self.path = reverse('sentry-organization-home', args=[self.organization.slug])

    def test_teamless_member_can_load(self):
        self.assert_teamless_member_can_access(self.path)

    def test_org_member_can_load(self):
        self.assert_org_member_can_access(self.path)

    def test_non_member_cannot_load(self):
        self.assert_non_member_cannot_access(self.path)


class OrganizationHomeTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team = self.create_team(organization=organization)
        project = self.create_project(team=team)

        path = reverse('sentry-organization-home', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-home.html')

        assert resp.context['organization'] == organization
        assert resp.context['team_list'] == [(team, [project])]
