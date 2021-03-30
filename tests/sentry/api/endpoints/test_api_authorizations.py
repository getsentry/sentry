from sentry.models import ApiApplication, ApiAuthorization, ApiToken
from sentry.testutils import APITestCase


class ApiAuthorizationsTest(APITestCase):
    endpoint = "sentry-api-0-api-authorizations"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


class ApiAuthorizationsListTest(ApiAuthorizationsTest):
    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        ApiAuthorization.objects.create(
            application=app, user=self.create_user("example@example.com")
        )

        response = self.get_valid_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(auth.id)


class ApiAuthorizationsDeleteTest(ApiAuthorizationsTest):
    method = "delete"

    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        token = ApiToken.objects.create(application=app, user=self.user)

        self.get_valid_response(authorization=auth.id, status_code=204)
        assert not ApiAuthorization.objects.filter(id=auth.id).exists()
        assert not ApiToken.objects.filter(id=token.id).exists()
