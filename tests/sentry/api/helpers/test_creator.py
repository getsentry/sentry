from rest_framework.request import Request

from sentry.api.helpers.creator import get_creator_reference
from sentry.auth.services.auth import AuthenticatedToken
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.service_accounts.auth import SERVICE_ACCOUNT_TOKEN_KIND
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user import User


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
