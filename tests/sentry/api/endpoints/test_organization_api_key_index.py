from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class OrganizationApiKeyIndex(APITestCase):
    def test_org_admin_can_access(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)

        path = reverse("sentry-api-0-organization-api-key-index", args=[organization.slug])

        resp = self.client.get(path)

        assert resp.status_code == 200

    def test_member_no_access(self):
        self.login_as(user=self.user)
        organization = self.create_organization(name="foo", owner=self.user)

        user = self.create_user("bar@example.com")
        self.create_member(organization=organization, user=user, role="member")

        path = reverse("sentry-api-0-organization-api-key-index", args=[organization.slug])

        self.login_as(user)

        resp = self.client.get(path)

        assert resp.status_code == 403

    def test_superuser_can_access(self):
        self.login_as(user=self.user)
        organization = self.create_organization(name="foo", owner=self.user)

        admin_user = self.create_user("admin@example.com", is_superuser=True)
        self.create_member(organization=organization, user=admin_user, role="admin")

        path = reverse("sentry-api-0-organization-api-key-index", args=[organization.slug])

        self.login_as(admin_user, superuser=True)

        resp = self.client.get(path)

        assert resp.status_code == 200
