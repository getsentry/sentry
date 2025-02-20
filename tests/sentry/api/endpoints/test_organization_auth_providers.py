from django.urls import reverse

from sentry import auth
from sentry.auth.partnership_configs import ChannelName
from sentry.auth.providers.fly.provider import FlyOAuth2Provider, NonPartnerFlyOAuth2Provider
from sentry.testutils.cases import APITestCase, PermissionTestCase


class OrganizationAuthProvidersPermissionTest(PermissionTestCase):
    def setUp(self):
        super().setUp()
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
    endpoint = "sentry-api-0-organization-auth-providers"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        auth.register(ChannelName.FLY_IO.value, FlyOAuth2Provider)
        self.addCleanup(auth.unregister, ChannelName.FLY_IO.value, FlyOAuth2Provider)

        auth.register(ChannelName.FLY_NON_PARTNER.value, NonPartnerFlyOAuth2Provider)
        self.addCleanup(
            auth.unregister, ChannelName.FLY_NON_PARTNER.value, NonPartnerFlyOAuth2Provider
        )

    def test_get_list_of_auth_providers(self):
        with self.feature("organizations:sso-basic"):
            response = self.get_success_response(self.organization.slug)
        providers = {d["key"] for d in response.data}
        assert "dummy" in providers
        assert ChannelName.FLY_IO.value not in providers
        assert ChannelName.FLY_NON_PARTNER.value not in providers
