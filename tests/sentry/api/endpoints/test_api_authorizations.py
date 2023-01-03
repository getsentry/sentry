from sentry.models import ApiApplication, ApiAuthorization, ApiToken
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class ApiAuthorizationsTest(APITestCase):
    endpoint = "sentry-api-0-api-authorizations"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@control_silo_test(stable=True)
class ApiAuthorizationsListTest(ApiAuthorizationsTest):
    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        ApiAuthorization.objects.create(
            application=app, user=self.create_user("example@example.com")
        )

        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(auth.id)


@control_silo_test(stable=True)
class ApiAuthorizationsDeleteTest(ApiAuthorizationsTest):
    method = "delete"

    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        token = ApiToken.objects.create(application=app, user=self.user)

        self.get_success_response(authorization=auth.id, status_code=204)
        assert not ApiAuthorization.objects.filter(id=auth.id).exists()
        assert not ApiToken.objects.filter(id=token.id).exists()
