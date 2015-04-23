from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuthProvider
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
    # this test isn't really specific to OrganizationHome, but it needs to
    # guarantee this behavior so we stuff it here
    def test_redirects_unlinked_sso_member(self):
        user = self.create_user('not-a-superuser@example.com')
        organization = self.create_organization(name='foo', owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(team=team)
        auth_provider = AuthProvider.objects.create(organization=organization)

        path = reverse('sentry-organization-home', args=[organization.slug])

        self.login_as(user)

        resp = self.client.get(path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver{}'.format(
            reverse('sentry-auth-link-identity', args=[organization.slug]),
        )

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
        assert resp.context['active_teams'] == [(team, [project])]
