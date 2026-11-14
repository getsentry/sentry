from django.urls import reverse

from sentry.auth.partnership_configs import ChannelName
from sentry.testutils.cases import APITestCase, PermissionTestCase


class OrganizationAuthProvidersPermissionTest(PermissionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.path = reverse(
            "sentry-api-0-organization-auth-providers", args=[self.organization.slug]
        )

    def test_owner_can_load(self) -> None:
        with self.feature("organizations:sso-basic"):
            self.assert_owner_can_access(self.path)

    def test_member_can_get(self) -> None:
        with self.feature("organizations:sso-basic"):
            self.assert_member_can_access(self.path)


class OrganizationAuthProviders(APITestCase):
    endpoint = "sentry-api-0-organization-auth-providers"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_get_list_of_auth_providers(self) -> None:
        with self.feature("organizations:sso-basic"):
            response = self.get_success_response(self.organization.slug)
        providers = {d["key"] for d in response.data}
        assert "dummy" in providers
        assert ChannelName.FLY_IO.value not in providers
        assert ChannelName.FLY_NON_PARTNER.value not in providers

    def test_oidc_is_hidden_without_its_feature(self) -> None:
        with self.feature({"organizations:sso-basic": True, "organizations:sso-oidc": False}):
            response = self.get_success_response(self.organization.slug)
        assert "oidc" not in {d["key"] for d in response.data}

        with self.feature(["organizations:sso-basic", "organizations:sso-oidc"]):
            response = self.get_success_response(self.organization.slug)
        assert "oidc" in {d["key"] for d in response.data}
