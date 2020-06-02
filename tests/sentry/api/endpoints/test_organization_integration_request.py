from __future__ import absolute_import

from sentry.testutils import APITestCase


class OrganizationIntegrationRequestTest(APITestCase):
    """Unit tests for emailing organization owners asking them to install an integration."""

    endpoint = "sentry-api-0-organization-integration-request"
    method = "post"

    def setUp(self):
        self.owner = self.create_user(email="owner@example.com", is_superuser=True)
        self.member = self.create_user(email="member@example.com")
        self.org = self.create_organization(owner=self.owner, name="My Org")
        self.create_member(user=self.member, organization=self.org, role="member")

    def test_integration_request(self):
        self.login_as(user=self.member)
        response = self.get_response(
            self.org.slug, providerSlug="github", providerType="first_party",
        )

        assert response.status_code == 201, response.content

    def test_integration_request_with_invalid_plugin(self):
        self.login_as(user=self.member)
        response = self.get_response(self.org.slug, providerSlug="ERROR", providerType="plugin",)

        assert response.status_code == 400, response.content

    def test_integration_request_with_invalid_sentryapp(self):
        self.login_as(user=self.member)
        response = self.get_response(
            self.org.slug, providerSlug="ERROR", providerType="sentry_app",
        )

        assert response.status_code == 400, response.content

    def test_integration_request_as_owner(self):
        self.login_as(user=self.owner)
        response = self.get_response(
            self.org.slug, providerSlug="github", providerType="first_party",
        )
        assert response.status_code == 200, response.content
        assert response.data["detail"] == "User can install integration"

    def test_integration_request_without_permissions(self):
        self.login_as(user=self.create_user(email="nonmember@example.com"))
        response = self.get_response(
            self.org.slug, providerSlug="github", providerType="first_party",
        )
        assert response.status_code == 403, response.content
