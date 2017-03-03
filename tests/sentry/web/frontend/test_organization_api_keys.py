from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ApiKey
from sentry.testutils import TestCase, PermissionTestCase


class OrganizationApiKeysPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationApiKeysPermissionTest, self).setUp()
        self.path = reverse('sentry-organization-api-keys', args=[self.organization.slug])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_member_cannot_load(self):
        self.assert_member_cannot_access(self.path)

    def test_manager_cannot_load(self):
        self.assert_manager_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class OrganizationApiKeysTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)

        key1 = ApiKey.objects.create(organization=organization, label='Bar')
        key2 = ApiKey.objects.create(organization=organization, label='Foo')

        path = reverse('sentry-organization-api-keys', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-api-keys.html')

        assert resp.context['organization'] == organization
        assert resp.context['key_list'] == [
            key1,
            key2,
        ]

    def test_creates_api_key(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-organization-api-keys', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.post(path, {'op': 'newkey'})

        assert resp.status_code == 302

        assert ApiKey.objects.filter(organization=organization).exists()
