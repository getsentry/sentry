from django.urls import reverse
from rest_framework import status

from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiTokensListTest(APITestCase):
    def test_simple(self):
        ApiToken.objects.create(user=self.user)
        ApiToken.objects.create(user=self.user)

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_never_cache(self):
        ApiToken.objects.create(user=self.user)
        ApiToken.objects.create(user=self.user)

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


@control_silo_test
class ApiTokensDeleteTest(APITestCase):
    def test_simple(self):
        token = ApiToken.objects.create(user=self.user)
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.delete(url, data={"token": token.token})
        assert response.status_code == 204
        assert not ApiToken.objects.filter(id=token.id).exists()

    def test_never_cache(self):
        token = ApiToken.objects.create(user=self.user)
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.delete(url, data={"token": token.token})
        assert response.status_code == 204
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )


@control_silo_test
class ApiTokensSuperUserTest(APITestCase):
    url = reverse("sentry-api-0-api-tokens")

    def test_get_as_su(self):
        super_user = self.create_user(is_superuser=True)
        user_token = ApiToken.objects.create(user=self.user)
        self.login_as(super_user, superuser=True)

        response = self.client.get(self.url, {"userId": self.user.id})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["token"] == user_token.token

    def test_get_as_su_implicit_userid(self):
        super_user = self.create_user(is_superuser=True)
        superuser_token = ApiToken.objects.create(user=super_user)
        user_token = ApiToken.objects.create(user=self.user)
        self.login_as(super_user, superuser=True)

        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["token"] != user_token.token
        assert response.data[0]["token"] == superuser_token.token

    def test_get_as_user(self):
        super_user = self.create_user(is_superuser=True)
        su_token = ApiToken.objects.create(user=super_user)
        self.login_as(super_user)
        # Ignores trying to fetch the user's token, since we're not an active superuser
        response = self.client.get(self.url, {"userId": self.user.id})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["token"] == su_token.token

    def test_delete_as_su(self):
        super_user = self.create_user(is_superuser=True)
        user_token = ApiToken.objects.create(user=self.user)
        self.login_as(super_user, superuser=True)

        response = self.client.delete(self.url, {"userId": self.user.id, "token": user_token.token})
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ApiToken.objects.filter(id=user_token.id).exists()

    def test_delete_as_su_implicit_userid(self):
        super_user = self.create_user(is_superuser=True)
        user_token = ApiToken.objects.create(user=self.user)
        su_token = ApiToken.objects.create(user=super_user)
        self.login_as(super_user, superuser=True)

        response = self.client.delete(self.url, {"token": user_token.token})
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert ApiToken.objects.filter(id=user_token.id).exists()
        assert ApiToken.objects.filter(id=su_token.id).exists()

        response = self.client.delete(self.url, {"token": su_token.token})
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert ApiToken.objects.filter(id=user_token.id).exists()
        assert not ApiToken.objects.filter(id=su_token.id).exists()

    def test_delete_as_user(self):
        super_user = self.create_user(is_superuser=True)
        user_token = ApiToken.objects.create(user=self.user)
        su_token = ApiToken.objects.create(user=super_user)
        self.login_as(super_user)
        # Fails trying to delete the user's token, since we're not an active superuser
        response = self.client.delete(self.url, {"userId": self.user.id, "token": user_token.token})
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert ApiToken.objects.filter(id=user_token.id).exists()
        assert ApiToken.objects.filter(id=su_token.id).exists()
