from django.core import mail
from django.test import override_settings

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


class OrganizationIntegrationRequestTest(APITestCase):
    """Unit tests for emailing organization owners asking them to install an integration."""

    endpoint = "sentry-api-0-organization-integration-request"
    method = "post"

    def setUp(self) -> None:
        self.owner = self.user
        self.member = self.create_user(email="member@example.com")
        self.create_member(user=self.member, organization=self.organization, role="member")
        self.login_as(user=self.member)

    def test_integration_request(self) -> None:
        self.get_success_response(
            self.organization.slug,
            providerSlug="github",
            providerType="first_party",
        )

    def test_integration_request_for_category(self) -> None:
        with self.tasks():
            self.get_success_response(
                self.organization.slug,
                providerSlug="source code management",
                providerType="category",
                status_code=201,
            )

        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject.endswith(
            "Your team member requested a source code management integration on Sentry"
        )
        body = mail.outbox[0].body
        assert "requested a source code management integration." in body
        assert "Install integration by clicking the link below" in body
        assert (
            f"/settings/{self.organization.slug}/integrations/"
            "?category=source%20code%20management&referrer=request_email"
        ) in body

    def test_integration_request_without_provider(self) -> None:
        with self.tasks():
            self.get_success_response(self.organization.slug, status_code=201)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject.endswith(
            "Your team member requested an integration on Sentry"
        )
        body = mail.outbox[0].body
        assert "requested an integration." in body
        assert "Install integration by clicking the link below" in body
        assert f"/settings/{self.organization.slug}/integrations/?referrer=request_email" in body

    def test_integration_request_with_only_provider_type(self) -> None:
        self.get_error_response(
            self.organization.slug,
            providerType="first_party",
            status_code=400,
        )

    def test_integration_request_with_invalid_category(self) -> None:
        self.get_error_response(
            self.organization.slug,
            providerSlug="alerting",
            providerType="category",
            status_code=400,
        )

    def test_integration_request_with_invalid_plugin(self) -> None:
        self.get_error_response(
            self.organization.slug,
            providerSlug="ERROR",
            providerType="plugin",
            status_code=400,
        )

    def test_integration_request_with_invalid_sentryapp(self) -> None:
        self.get_error_response(
            self.organization.slug,
            providerSlug="ERROR",
            providerType="sentry_app",
            status_code=400,
        )

    def test_integration_request_with_invalid_integration(self) -> None:
        self.get_error_response(
            self.organization.slug,
            providerSlug="ERROR",
            providerType="first_party",
            status_code=400,
        )

    def test_integration_request_as_owner(self) -> None:
        self.login_as(user=self.owner)
        response = self.get_success_response(
            self.organization.slug,
            providerSlug="github",
            providerType="first_party",
        )
        assert response.data["detail"] == "User can install integration"

    def test_integration_request_without_permissions(self) -> None:
        self.login_as(user=self.create_user(email="nonmember@example.com"))
        self.get_error_response(
            self.organization.slug,
            providerSlug="github",
            providerType="first_party",
            status_code=403,
        )

    @override_settings(SEER_API_SHARED_SECRET="service-account-secret-32-bytes-long")
    @with_feature("organizations:service-accounts")
    def test_service_account_cannot_request_integration(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization, scope_list=["org:read"]
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.organization.id,
            ),
            key="service-account-secret-32-bytes-long",
        )

        response = self.get_error_response(
            self.organization.slug,
            providerSlug="github",
            providerType="first_party",
            status_code=403,
            extra_headers={"HTTP_X_VIEWER_CONTEXT": viewer_context},
        )

        assert response.data["detail"]["code"] == "user-required"
