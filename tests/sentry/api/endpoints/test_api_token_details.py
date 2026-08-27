from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from sentry.models.apitoken import ApiToken
from sentry.seer import agent_token
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.silo import control_silo_test

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"


@control_silo_test
class ApiTokenGetTest(APITestCase):
    endpoint = "sentry-api-0-api-token-details"

    def test_simple(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1", scope_list=["event:read"])

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_200_OK)
        assert response.content

        res = response.data

        assert res.get("id") == str(token.id)
        assert res.get("name") == "token 1"
        assert res.get("scopes") == ["event:read"]

    def test_never_cache(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_200_OK)
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_invalid_token_id(self) -> None:
        self.login_as(self.user)
        self.get_error_response(-1, status_code=status.HTTP_404_NOT_FOUND)

    def test_non_integer_token_id(self) -> None:
        self.login_as(self.user)
        self.get_error_response("abc", status_code=status.HTTP_404_NOT_FOUND)

    def test_no_auth(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")
        self.get_error_response(token.id, status_code=status.HTTP_403_FORBIDDEN)

    def test_deny_token_access(self) -> None:
        token = self.create_user_auth_token(user=self.user, name="token 1")
        self.get_error_response(
            token.id,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=status.HTTP_403_FORBIDDEN,
        )

    def test_invalid_user_id(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")
        self.login_as(self.user, superuser=True)
        self.get_error_response(
            token.id, qs_params={"userId": "abc"}, status_code=status.HTTP_404_NOT_FOUND
        )


@control_silo_test
class ApiTokenPutTest(APITestCase):
    endpoint = "sentry-api-0-api-token-details"
    method = "PUT"

    def test_simple(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")
        payload = {"name": "new token"}

        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)

        tokenNew = ApiToken.objects.get(user=self.user)
        assert tokenNew.name == "new token"
        assert tokenNew.get_scopes() == token.get_scopes()

    def test_never_cache(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")
        payload = {"name": "new token"}

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_remove_name(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="name")
        payload = {"name": ""}

        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)

        token = ApiToken.objects.get(user=self.user)
        assert token.name == ""

    def test_add_name(self) -> None:
        token = ApiToken.objects.create(user=self.user)
        payload = {"name": "new token"}

        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)

        token = ApiToken.objects.get(user=self.user)
        assert token.name == "new token"

    def test_name_too_long(self) -> None:
        token = ApiToken.objects.create(user=self.user)
        payload = {
            "name": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in"
        }

        self.login_as(self.user)
        self.get_error_response(token.id, status_code=status.HTTP_400_BAD_REQUEST, **payload)

    def test_editing_scopes(self) -> None:
        token = ApiToken.objects.create(user=self.user)
        payload = {"name": "new token", "scopes": ["event:read"]}

        self.login_as(self.user)
        response = self.get_error_response(
            token.id, status_code=status.HTTP_403_FORBIDDEN, **payload
        )
        assert response.content
        assert response.data == {"error": "Only auth token name can be edited after creation"}

    def test_invalid_token_id(self) -> None:
        payload = {"name": "new token"}

        self.login_as(self.user)
        self.get_error_response(-1, status_code=status.HTTP_404_NOT_FOUND, **payload)

    def test_non_integer_token_id(self) -> None:
        payload = {"name": "new token"}

        self.login_as(self.user)
        self.get_error_response("abc", status_code=status.HTTP_404_NOT_FOUND, **payload)

    def test_no_auth(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")
        payload = {"name": "new token"}

        self.get_error_response(token.id, status_code=status.HTTP_403_FORBIDDEN, **payload)

    def test_deny_token_access(self) -> None:
        token = self.create_user_auth_token(user=self.user, name="token 1")
        self.get_error_response(
            token.id,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=status.HTTP_403_FORBIDDEN,
            name="new token",
        )
        token.refresh_from_db()
        assert token.name == "token 1"

    def test_invalid_user_id(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")
        payload = {"name": "new token"}

        self.login_as(self.user, superuser=True)
        self.get_error_response(
            token.id, qs_params={"userId": "abc"}, status_code=status.HTTP_404_NOT_FOUND, **payload
        )


@control_silo_test
class ApiTokenDeleteTest(APITestCase):
    endpoint = "sentry-api-0-api-token-details"
    method = "DELETE"

    def test_simple(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")
        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_204_NO_CONTENT)
        assert not ApiToken.objects.filter(id=token.id).exists()

    def test_never_cache(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_204_NO_CONTENT)
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_invalid_token_id(self) -> None:
        self.login_as(self.user)
        self.get_error_response(-1, status_code=status.HTTP_404_NOT_FOUND)

    def test_non_integer_token_id(self) -> None:
        self.login_as(self.user)
        self.get_error_response("abc", status_code=status.HTTP_404_NOT_FOUND)

    def test_no_auth(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.get_error_response(token.id, status_code=status.HTTP_403_FORBIDDEN)

    def test_deny_token_access(self) -> None:
        token = self.create_user_auth_token(user=self.user, name="token 1")
        self.get_error_response(
            token.id,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=status.HTTP_403_FORBIDDEN,
        )
        assert ApiToken.objects.filter(id=token.id).exists()

    def test_invalid_user_id(self) -> None:
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.login_as(self.user, superuser=True)
        self.get_error_response(
            token.id, qs_params={"userId": "abc"}, status_code=status.HTTP_404_NOT_FOUND
        )


@control_silo_test
class ApiTokenDetailsImpersonationTest(APITestCase):
    def setUp(self) -> None:
        self.impersonator = self.create_user(is_superuser=True)
        self.target_user = self.create_user()

    def test_impersonated_put_blocked(self) -> None:
        token = ApiToken.objects.create(user=self.target_user, name="token 1")
        url = reverse("sentry-api-0-api-token-details", args=[token.id])
        self.login_as(self.target_user)
        with simulate_impersonation(self.impersonator):
            response = self.client.put(url, data={"name": "renamed"})
        assert response.status_code == status.HTTP_403_FORBIDDEN
        token.refresh_from_db()
        assert token.name == "token 1"

    def test_impersonated_delete_blocked(self) -> None:
        token = ApiToken.objects.create(user=self.target_user, name="token 1")
        url = reverse("sentry-api-0-api-token-details", args=[token.id])
        self.login_as(self.target_user)
        with simulate_impersonation(self.impersonator):
            response = self.client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert ApiToken.objects.filter(id=token.id).exists()

    def test_impersonated_get_allowed(self) -> None:
        token = ApiToken.objects.create(user=self.target_user, name="token 1")
        url = reverse("sentry-api-0-api-token-details", args=[token.id])
        self.login_as(self.target_user)
        with simulate_impersonation(self.impersonator):
            response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK


@control_silo_test
@override_settings(SEER_API_SHARED_SECRET=SECRET)
class ApiTokenDetailsAgentTokenTest(APITestCase):
    def test_agent_token_cannot_manage_personal_tokens(self) -> None:
        organization = self.create_organization(owner=self.user)
        bearer, _ = agent_token.encode_agent_token(
            user_id=self.user.id,
            organization_id=organization.id,
            scopes=["org:read", "org:write"],
            session_id="api-token-details",
        )

        with self.feature(agent_token.FEATURE_FLAG):
            for method in ("get", "put", "delete"):
                with self.subTest(method=method):
                    personal_token = ApiToken.objects.create(user=self.user, name="personal token")
                    url = reverse("sentry-api-0-api-token-details", args=[personal_token.id])
                    response = getattr(self.client, method)(
                        url,
                        data={"name": "renamed"},
                        format="json",
                        HTTP_AUTHORIZATION=f"Bearer {bearer}",
                    )

                    assert response.status_code == status.HTTP_403_FORBIDDEN
                    assert ApiToken.objects.filter(id=personal_token.id).exists()
