from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ApiKey
from sentry.testutils import TestCase, PermissionTestCase


class OrganizationApiKeySettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationApiKeySettingsPermissionTest, self).setUp()
        key = ApiKey.objects.create(organization=self.organization)
        self.path = reverse('sentry-organization-api-key-settings', args=[
            self.organization.slug, key.id
        ])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_member_cannot_load(self):
        self.assert_member_cannot_access(self.path)

    def test_manager_cannot_load(self):
        self.assert_manager_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class OrganizationApiKeySettingsTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)

        key = ApiKey.objects.create(organization=organization)

        path = reverse('sentry-organization-api-key-settings', args=[
            organization.slug, key.id,
        ])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-api-key-settings.html')

        assert resp.context['organization'] == organization
        assert resp.context['key'] == key

    def test_not_found(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-organization-api-key-settings', args=[
            organization.slug, 99999,
        ])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 404
