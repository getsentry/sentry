from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiTokensListTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        for _ in range(2):
            ApiToken.objects.create(user=self.user)

    def test_simple(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-api-tokens")
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_never_cache(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-api-tokens")
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_deny_token_access(self):
        token = ApiToken.objects.create(user=self.user, scope_list=[])

        url = reverse("sentry-api-0-api-tokens")
        response = self.client.get(url, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 403, response.content


@control_silo_test
class ApiTokensCreateTest(APITestCase):
    def test_no_scopes(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(url)
        assert response.status_code == 400

    def test_simple(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(url, data={"scopes": ["event:read"]})
        assert response.status_code == 201
        token = ApiToken.objects.get(user=self.user)
        assert not token.expires_at
        assert not token.refresh_token
        assert token.get_scopes() == ["event:read"]

    def test_never_cache(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(url, data={"scopes": ["event:read"]})
        assert response.status_code == 201
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_invalid_choice(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(
            url,
            data={
                "scopes": [
                    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                ]
            },
        )
        assert response.status_code == 400
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_with_name(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(
            url,
            data={"name": "testname1", "scopes": ["event:read"]},
        )
        assert response.status_code == 201

        token = ApiToken.objects.get(user=self.user)
        assert token.name == "testname1"

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        assert response.data[0]["name"] == "testname1"

    def test_without_name(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(
            url,
            data={"scopes": ["event:read"]},
        )
        assert response.status_code == 201

        token = ApiToken.objects.get(user=self.user)
        assert token.name is None

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        assert response.data[0]["name"] is None


@control_silo_test
class ApiTokensDeleteTest(APITestCase):
    def test_simple(self):
        token = ApiToken.objects.create(user=self.user)
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.delete(url, data={"tokenId": token.id})
        assert response.status_code == 204
        assert not ApiToken.objects.filter(id=token.id).exists()

    def test_never_cache(self):
        token = ApiToken.objects.create(user=self.user)
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.delete(url, data={"tokenId": token.id})
        assert response.status_code == 204
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_returns_400_when_no_token_param_is_sent(self) -> None:
        token = ApiToken.objects.create(user=self.user)
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.delete(url, data={})
        assert response.status_code == 400
        assert ApiToken.objects.filter(id=token.id).exists()


@control_silo_test
class ApiTokensSuperUserTest(APITestCase):
    endpoint = "sentry-api-0-api-tokens"

    def setUp(self):
        super().setUp()
        self.superuser = self.create_user(is_superuser=True)
        self.user_token = ApiToken.objects.create(user=self.user)
        self.superuser_token = ApiToken.objects.create(user=self.superuser)

        self.login_as(self.superuser, superuser=True)

    def test_get_as_su(self):
        response = self.get_success_response(userId=self.user.id)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.user_token.id)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @with_feature("auth:enterprise-superuser-read-write")
    def test_get_as_su_read_write(self):
        response = self.get_success_response(userId=self.user.id)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.user_token.id)

        self.add_user_permission(self.superuser, "superuser.write")

        response = self.get_success_response(userId=self.user.id)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.user_token.id)

    def test_get_as_su_implicit_userid(self):
        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] != str(self.user_token.id)
        assert response.data[0]["id"] == str(self.superuser_token.id)

    def test_get_as_user(self):
        self.login_as(self.superuser)

        # Ignores trying to fetch the user's token, since we're not an active superuser
        response = self.get_success_response(userId=self.user.id)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.superuser_token.id)

    def test_delete_as_su(self):
        self.get_success_response(
            method="delete",
            userId=self.user.id,
            tokenId=self.user_token.id,
            status=status.HTTP_204_NO_CONTENT,
        )
        assert not ApiToken.objects.filter(id=self.user_token.id).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    @with_feature("auth:enterprise-superuser-read-write")
    def test_delete_as_su_read_write(self):
        self.get_error_response(
            method="delete",
            userId=self.user.id,
            tokenId=self.user_token.id,
            status=status.HTTP_400_BAD_REQUEST,
        )
        assert ApiToken.objects.filter(id=self.user_token.id).exists()

        self.add_user_permission(self.superuser, "superuser.write")
        self.get_success_response(
            method="delete",
            userId=self.user.id,
            tokenId=self.user_token.id,
            status=status.HTTP_204_NO_CONTENT,
        )
        assert not ApiToken.objects.filter(id=self.user_token.id).exists()

    def test_delete_as_su_implicit_userid(self):
        # The superusers' id will be used since no override is sent, and because it does not exist, it is a bad request
        self.get_error_response(
            method="delete",
            tokenId=self.user_token.id,
            status=status.HTTP_400_BAD_REQUEST,
        )
        assert ApiToken.objects.filter(id=self.user_token.id).exists()
        assert ApiToken.objects.filter(id=self.superuser_token.id).exists()

        self.get_success_response(
            method="delete",
            tokenId=self.superuser_token.id,
            status=status.HTTP_204_NO_CONTENT,
        )
        assert ApiToken.objects.filter(id=self.user_token.id).exists()
        assert not ApiToken.objects.filter(id=self.superuser_token.id).exists()

    def test_delete_as_user(self):
        self.login_as(self.superuser)
        # Fails trying to delete the user's token, since we're not an active superuser
        self.get_error_response(
            method="delete",
            userId=self.user.id,
            tokenId=self.user_token.id,
            status=status.HTTP_400_BAD_REQUEST,
        )
        assert ApiToken.objects.filter(id=self.user_token.id).exists()
        assert ApiToken.objects.filter(id=self.superuser_token.id).exists()
