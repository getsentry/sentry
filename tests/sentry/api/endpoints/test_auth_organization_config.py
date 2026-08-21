from unittest import mock

from sentry.auth.exceptions import ProviderNotRegistered
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class AuthOrganizationConfigEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-organization-config"
    method = "get"

    def test_password_login_configuration_is_public(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")

        response = self.get_success_response(organization.slug)

        assert response.data == {
            "authenticated": False,
            "userIsAuthenticated": False,
            "canRegister": False,
            "joinRequestUrl": "/join-request/acme/",
            "loginMethod": "password",
            "ssoRequired": False,
            "organization": {
                "avatarUrl": None,
                "name": "Acme",
                "slug": "acme",
            },
            "provider": None,
            "warnings": [],
        }

    def test_sso_login_configuration(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        self.create_auth_provider(organization_id=organization.id, provider="dummy")

        response = self.get_success_response(organization.slug)

        assert response.data["loginMethod"] == "sso"
        assert response.data["provider"] == {"key": "dummy", "name": "Dummy"}
        assert response.data["ssoRequired"] is True

    def test_sso_is_optional_when_unlinked_members_are_allowed(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        auth_provider = self.create_auth_provider(organization_id=organization.id, provider="dummy")
        auth_provider.flags.allow_unlinked = True
        auth_provider.save()

        response = self.get_success_response(organization.slug)

        assert response.data["loginMethod"] == "sso"
        assert response.data["ssoRequired"] is False

    def test_unregistered_sso_provider_is_temporarily_unavailable(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        self.create_auth_provider(organization_id=organization.id, provider="dummy")

        with mock.patch(
            "sentry.api.endpoints.auth_organization_config.AuthProvider.get_provider",
            side_effect=ProviderNotRegistered("dummy"),
        ):
            response = self.get_error_response(organization.slug, status_code=503)

        assert response.data == {"detail": "Organization authentication is temporarily unavailable"}

    @mock.patch(
        "sentry.api.endpoints.auth_organization_config.OrganizationAvatarReplica.objects.filter"
    )
    def test_avatar_url(self, mock_filter: mock.MagicMock) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        avatar = mock.MagicMock()
        avatar.avatar_type = 1
        avatar.absolute_url.return_value = "https://example.com/organization-avatar/acme/avatar/"
        mock_filter.return_value.first.return_value = avatar

        response = self.get_success_response(organization.slug)

        assert (
            response.data["organization"]["avatarUrl"]
            == "https://example.com/organization-avatar/acme/avatar/"
        )

    @mock.patch(
        "sentry.api.endpoints.auth_organization_config.OrganizationAvatarReplica.objects.filter"
    )
    def test_letter_avatar_has_no_url(self, mock_filter: mock.MagicMock) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        avatar = mock.MagicMock()
        avatar.avatar_type = 0
        mock_filter.return_value.first.return_value = avatar

        response = self.get_success_response(organization.slug)

        assert response.data["organization"]["avatarUrl"] is None
        avatar.absolute_url.assert_not_called()

    def test_unknown_organization(self) -> None:
        self.get_error_response("does-not-exist", status_code=404)

    def test_authenticated_non_member_warning(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        user = self.create_user(email="user@example.com")
        self.login_as(user)

        response = self.get_success_response(organization.slug)

        assert response.data["authenticated"] is True
        assert response.data["userIsAuthenticated"] is False
        assert response.data["warnings"] == [
            "Your account (user@example.com) is not a member of the Acme organization. "
            "Ask an organization admin to invite you, or sign in with a different account."
        ]

    def test_authenticated_member_can_access_password_organization(self) -> None:
        user = self.create_user(email="user@example.com")
        organization = self.create_organization(owner=user, name="Acme", slug="acme")
        self.login_as(user)

        response = self.get_success_response(organization.slug)

        assert response.data["userIsAuthenticated"] is True

    def test_authenticated_member_requires_sso(self) -> None:
        owner = self.create_user(email="owner@example.com")
        organization = self.create_organization(owner=owner, name="Acme", slug="acme")
        user = self.create_user(email="user@example.com")
        self.create_member(organization=organization, user=user)
        self.create_auth_provider(organization_id=organization.id, provider="dummy")
        self.login_as(user)

        response = self.get_success_response(organization.slug)

        assert response.data["authenticated"] is True
        assert response.data["userIsAuthenticated"] is False

    def test_authenticated_member_has_completed_sso(self) -> None:
        owner = self.create_user(email="owner@example.com")
        organization = self.create_organization(owner=owner, name="Acme", slug="acme")
        user = self.create_user(email="user@example.com")
        self.create_member(organization=organization, user=user)
        auth_provider = self.create_auth_provider(organization_id=organization.id, provider="dummy")
        self.create_auth_identity(auth_provider=auth_provider, user_id=user.id, ident=user.email)
        member = organization_service.check_membership_by_id(
            organization_id=organization.id, user_id=user.id
        )
        assert member is not None
        setattr(member.flags, "sso:linked", True)
        organization_service.update_membership_flags(organization_member=member)
        self.login_as(user, organization_id=organization.id)

        response = self.get_success_response(organization.slug)

        assert response.data["userIsAuthenticated"] is True

    def test_join_requests_disabled(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        with assume_test_silo_mode(SiloMode.CELL):
            organization.update_option("sentry:join_requests", False)

        response = self.get_success_response(organization.slug)

        assert response.data["joinRequestUrl"] is None

    def test_preserves_query_string_in_join_request_url(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")

        response = self.get_success_response(organization.slug, next="/issues/")

        assert response.data["joinRequestUrl"] == "/join-request/acme/?next=%2Fissues%2F"

    def test_session_expired_warning(self) -> None:
        organization = self.create_organization(name="Acme", slug="acme")
        self.client.cookies["session_expired"] = "1"

        response = self.get_success_response(organization.slug)

        assert response.data["warnings"] == ["Your session has expired."]
        assert response.cookies["session_expired"]["max-age"] == 0
