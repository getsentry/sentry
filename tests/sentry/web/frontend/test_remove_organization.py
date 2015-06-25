from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Organization, OrganizationStatus
from sentry.testutils import TestCase, PermissionTestCase


class RemoveOrganizationPermissionTest(PermissionTestCase):
    def setUp(self):
        super(RemoveOrganizationPermissionTest, self).setUp()
        self.path = reverse('sentry-remove-organization', args=[self.organization.slug])

    def test_teamless_owner_cannot_load(self):
        self.assert_teamless_owner_cannot_access(self.path)

    def test_org_admin_cannot_load(self):
        self.assert_org_admin_cannot_access(self.path)

    def test_org_owner_can_load(self):
        self.assert_org_owner_can_access(self.path)


class RemoveOrganizationTest(TestCase):
    def setUp(self):
        super(RemoveOrganizationTest, self).setUp()

        self.organization = self.create_organization(name='foo', owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.path = reverse('sentry-remove-organization', args=[self.organization.slug])

        self.login_as(self.user)

    def test_renders_with_context(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/remove-organization.html')

        assert resp.context['organization'] == self.organization
        assert resp.context['form']
        assert resp.context['team_list']

    def test_success(self):
        user2 = self.create_user('bar@example.com')

        resp = self.client.post(self.path)

        assert resp.status_code == 302

        organization = Organization.objects.get(id=self.organization.id)

        assert organization.status == OrganizationStatus.PENDING_DELETION

    def test_cannot_remove_default(self):
        Organization.objects.all().delete()

        org = self.create_organization()

        self.login_as(self.user)

        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug,
        })

        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            resp = self.client.post(self.path)

        assert resp.status_code == 302

        organization = Organization.objects.get(id=org.id)

        assert organization.status == OrganizationStatus.VISIBLE
