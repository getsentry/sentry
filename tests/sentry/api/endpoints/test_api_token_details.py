from rest_framework import status

from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiTokenGetTest(APITestCase):
    endpoint = "sentry-api-0-api-token-details"

    def test_simple(self):
        token = ApiToken.objects.create(user=self.user, name="token 1", scope_list=["event:read"])

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_200_OK)
        assert response.content

        res = response.data

        assert res.get("id") == str(token.id)
        assert res.get("name") == "token 1"
        assert res.get("scopes") == ["event:read"]

    def test_never_cache(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_200_OK)
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_invalid_token_id(self):
        self.login_as(self.user)
        self.get_error_response(-1, status_code=status.HTTP_404_NOT_FOUND)

    def test_no_auth(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")
        self.get_error_response(token.id, status_code=status.HTTP_401_UNAUTHORIZED)

    def test_invalid_user_id(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")
        self.login_as(self.user, superuser=True)
        self.get_error_response(
            token.id, qs_params={"userId": "abc"}, status_code=status.HTTP_404_NOT_FOUND
        )


@control_silo_test
class ApiTokenPutTest(APITestCase):
    endpoint = "sentry-api-0-api-token-details"
    method = "PUT"

    def test_simple(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")
        payload = {"name": "new token"}

        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)

        tokenNew = ApiToken.objects.get(user=self.user)
        assert tokenNew.name == "new token"
        assert tokenNew.get_scopes() == token.get_scopes()

    def test_never_cache(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")
        payload = {"name": "new token"}

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_remove_name(self):
        token = ApiToken.objects.create(user=self.user, name="name")
        payload = {"name": ""}

        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)

        token = ApiToken.objects.get(user=self.user)
        assert token.name == ""

    def test_add_name(self):
        token = ApiToken.objects.create(user=self.user)
        payload = {"name": "new token"}

        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_200_OK, **payload)

        token = ApiToken.objects.get(user=self.user)
        assert token.name == "new token"

    def test_name_too_long(self):
        token = ApiToken.objects.create(user=self.user)
        payload = {
            "name": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in"
        }

        self.login_as(self.user)
        self.get_error_response(token.id, status_code=status.HTTP_400_BAD_REQUEST, **payload)

    def test_editing_scopes(self):
        token = ApiToken.objects.create(user=self.user)
        payload = {"name": "new token", "scopes": ["event:read"]}

        self.login_as(self.user)
        response = self.get_error_response(
            token.id, status_code=status.HTTP_403_FORBIDDEN, **payload
        )
        assert response.content
        assert response.data == {"error": "Only auth token name can be edited after creation"}

    def test_invalid_token_id(self):
        payload = {"name": "new token"}

        self.login_as(self.user)
        self.get_error_response(-1, status_code=status.HTTP_404_NOT_FOUND, **payload)

    def test_no_auth(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")
        payload = {"name": "new token"}

        self.get_error_response(token.id, status_code=status.HTTP_401_UNAUTHORIZED, **payload)

    def test_invalid_user_id(self):
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

    def test_simple(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")
        self.login_as(self.user)
        self.get_success_response(token.id, status_code=status.HTTP_204_NO_CONTENT)
        assert not ApiToken.objects.filter(id=token.id).exists()

    def test_never_cache(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.login_as(self.user)
        response = self.get_success_response(token.id, status_code=status.HTTP_204_NO_CONTENT)
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_invalid_token_id(self):
        self.login_as(self.user)
        self.get_error_response(-1, status_code=status.HTTP_404_NOT_FOUND)

    def test_no_auth(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.get_error_response(token.id, status_code=status.HTTP_401_UNAUTHORIZED)

    def test_invalid_user_id(self):
        token = ApiToken.objects.create(user=self.user, name="token 1")

        self.login_as(self.user, superuser=True)
        self.get_error_response(
            token.id, qs_params={"userId": "abc"}, status_code=status.HTTP_404_NOT_FOUND
        )
