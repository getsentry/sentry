from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, PermissionTestCase


class OrganizationAuthProvidersPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationAuthProvidersPermissionTest, self).setUp()
        self.path = reverse(
            "sentry-api-0-organization-auth-providers", args=[self.organization.slug]
        )

    def test_owner_can_load(self):
        with self.feature("organizations:sso-basic"):
            self.assert_owner_can_access(self.path)

    def test_member_can_get(self):
        with self.feature("organizations:sso-basic"):
            self.assert_member_can_access(self.path)


class OrganizationAuthProviders(APITestCase):
    def test_get_list_of_auth_providers(self):
        organization = self.create_organization(name="foo", owner=self.user)

        path = reverse("sentry-api-0-organization-auth-providers", args=[organization.slug])

        self.login_as(self.user)

        with self.feature("organizations:sso-basic"):
            resp = self.client.get(path)

        assert resp.status_code == 200
        assert any(d["key"] == "dummy" for d in resp.data)
