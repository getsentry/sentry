from django.test import override_settings
from rest_framework.request import Request

from sentry.api.base import DEFAULT_AUTHENTICATION
from sentry.api.helpers.creator import ActorReference, get_actor_reference, get_creator_reference
from sentry.auth.services.auth import AuthenticatedToken
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.seer import agent_token
from sentry.service_accounts.auth import SERVICE_ACCOUNT_TOKEN_KIND
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user import User
from sentry.utils.security.orgauthtoken_token import hash_token


class GetCreatorReferenceTest(TestCase):
    def make_drf_request(
        self, user: User | None = None, auth: AuthenticatedToken | None = None
    ) -> Request:
        return drf_request_from_request(self.make_request(user=user, auth=auth))

    def test_user(self) -> None:
        request = self.make_drf_request(user=self.user)

        assert get_creator_reference(request) == {
            "created_by_id": self.user.id,
            "created_by_service_account_id": None,
            "created_by_org_auth_token_id": None,
        }

    def test_service_account(self) -> None:
        service_account = self.create_service_account(organization=self.organization)
        auth = AuthenticatedToken(
            kind=SERVICE_ACCOUNT_TOKEN_KIND,
            entity_id=service_account.id,
            organization_id=self.organization.id,
        )
        request = self.make_drf_request(auth=auth)

        assert get_creator_reference(request) == {
            "created_by_id": None,
            "created_by_service_account_id": service_account.id,
            "created_by_org_auth_token_id": None,
        }

    def test_service_account_with_user(self) -> None:
        service_account = self.create_service_account(organization=self.organization)
        auth = AuthenticatedToken(
            kind=SERVICE_ACCOUNT_TOKEN_KIND,
            entity_id=service_account.id,
            organization_id=self.organization.id,
        )
        request = self.make_drf_request(user=self.user, auth=auth)

        assert get_creator_reference(request) == {
            "created_by_id": None,
            "created_by_service_account_id": service_account.id,
            "created_by_org_auth_token_id": None,
        }

    def test_org_auth_token(self) -> None:
        with assume_test_silo_mode_of(OrgAuthToken):
            token = self.create_org_auth_token(
                name="ci token",
                token_hashed="abc123",
                organization_id=self.organization.id,
                scope_list=["org:ci"],
            )
        request = self.make_drf_request(auth=AuthenticatedToken.from_token(token))

        assert get_creator_reference(request) == {
            "created_by_id": None,
            "created_by_service_account_id": None,
            "created_by_org_auth_token_id": token.id,
        }

    def test_unauthenticated(self) -> None:
        request = self.make_drf_request()

        assert get_creator_reference(request) == {
            "created_by_id": None,
            "created_by_service_account_id": None,
            "created_by_org_auth_token_id": None,
        }


class GetActorReferenceTest(TestCase):
    def authenticate(self, user: User | None = None, authorization: str | None = None) -> Request:
        """A request authenticated the way API endpoints authenticate it."""
        django_request = self.make_request(user=user)
        if authorization is not None:
            django_request.META["HTTP_AUTHORIZATION"] = authorization
        return Request(django_request, authenticators=[cls() for cls in DEFAULT_AUTHENTICATION])

    def test_session_user(self) -> None:
        request = self.authenticate(user=self.user)

        assert get_actor_reference(request) == ActorReference(user_id=self.user.id)

    def test_personal_token(self) -> None:
        token = self.create_user_auth_token(self.user, scope_list=["org:read"])
        request = self.authenticate(authorization=f"Bearer {token.token}")

        assert get_actor_reference(request) == ActorReference(user_id=self.user.id)

    def test_oauth_token(self) -> None:
        application = self.create_api_application(owner=self.create_user())
        token = self.create_user_auth_token(
            self.user, scope_list=["org:read"], application=application
        )
        request = self.authenticate(authorization=f"Bearer {token.token}")

        assert get_actor_reference(request) == ActorReference(user_id=self.user.id)

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    @with_feature(agent_token.FEATURE_FLAG)
    def test_seer_agent_token_is_the_delegating_user(self) -> None:
        token, _ = agent_token.encode_agent_token(
            user_id=self.user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="s1",
        )
        request = self.authenticate(authorization=f"Bearer {token}")

        assert get_actor_reference(request) == ActorReference(user_id=self.user.id)

    def test_internal_integration_is_its_user(self) -> None:
        integration = self.create_internal_integration(
            organization=self.organization, scopes=("org:read",)
        )
        token = self.create_internal_integration_token(
            user=self.user, internal_integration=integration
        )
        request = self.authenticate(authorization=f"Bearer {token.token}")

        assert integration.proxy_user_id is not None
        assert get_actor_reference(request) == ActorReference(user_id=integration.proxy_user_id)

    @with_feature("organizations:service-accounts")
    def test_service_account(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization, scope_list=["org:read"]
        )
        _, token_str = self.create_service_account_token(
            service_account, scope_list=["org:read"], created_by=self.user
        )
        request = self.authenticate(authorization=f"Bearer {token_str}")

        assert get_actor_reference(request) == ActorReference(service_account_id=service_account.id)

    def test_org_auth_token(self) -> None:
        token_str = "sntrys_abc123_xyz"
        with assume_test_silo_mode_of(OrgAuthToken):
            token = self.create_org_auth_token(
                name="ci token",
                token_hashed=hash_token(token_str),
                organization_id=self.organization.id,
                scope_list=["org:ci"],
            )
        request = self.authenticate(authorization=f"Bearer {token_str}")

        assert get_actor_reference(request) == ActorReference(org_auth_token_id=token.id)

    def test_unauthenticated(self) -> None:
        request = self.authenticate()

        assert get_actor_reference(request) == ActorReference()
