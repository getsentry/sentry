from django.urls import reverse

from sentry.testutils import APITestCase, PermissionTestCase
from sentry.testutils.silo import region_silo_test

from sentry import auth

from sentry.auth.providers.fly.provider import FlyOAuth2Provider


@region_silo_test
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


class TestBillingHistory:
    sponsored_type = None

    def __init__(self, sponsorship) -> None:
        self.sponsored_type = sponsorship


class TestSubscription:

    def current_history(self) -> TestBillingHistory:
        return TestBillingHistory(4)


@region_silo_test
class OrganizationAuthProviders(APITestCase):
    endpoint = "sentry-api-0-organization-auth-providers"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        auth.register("Fly IO", FlyOAuth2Provider)
        self.addCleanup(auth.unregister, "Fly IO", FlyOAuth2Provider)

    def test_get_list_of_auth_providers(self):
        with self.feature("organizations:sso-basic"):
            response = self.get_success_response(self.organization.slug)
        assert any(d["key"] == "dummy" for d in response.data)
        assert False

    def test_get_list_for_non_partner_org(self):
        with self.feature("organizations:sso-basic"):
            response = self.get_success_response(self.organization.slug)
        assert any(d["key"] == "Fly IO" for d in response.data) is False

    def test_get_list_for_partnered_org(self):
        self.organization.subscription = TestSubscription()
        print("org in test", self.organization, self.organization.subscription.current_history().sponsored_type)
        with self.feature("organizations:sso-basic"):
            response = self.get_success_response(self.organization.slug)
        assert any(d["key"] == "Fly IO" for d in response.data)
