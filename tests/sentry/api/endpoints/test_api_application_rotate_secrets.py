from django.urls import reverse

from sentry.models.apiapplication import ApiApplication
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiApplicationRotateSecretTest(APITestCase):
    def setUp(self):
        self.app = ApiApplication.objects.create(owner=self.user, name="a")
        self.path = reverse("sentry-api-0-api-application-rotate-secret", args=[self.app.client_id])

    def test_unauthenticated_call(self):
        response = self.client.post(self.path)
        assert response.status_code == 403

    def test_non_owner_call(self):
        """
        Tests that an authenticated user cannot rotate the secret for an ApiApplication they don't own.
        """
        self.login_as(self.user)
        other_user = self.create_user()
        other_app = ApiApplication.objects.create(owner=other_user, name="b")
        response = self.client.post(
            reverse("sentry-api-0-api-application-rotate-secret", args=[other_app.client_id])
        )
        assert response.status_code == 404

    def test_invalid_app_id(self):
        self.login_as(self.user)
        path_with_invalid_id = reverse("sentry-api-0-api-application-rotate-secret", args=["abc"])
        response = self.client.post(path_with_invalid_id)
        assert response.status_code == 404

    def test_valid_call(self):
        self.login_as(self.user)
        old_secret = self.app.client_secret
        response = self.client.post(self.path, data={})
        new_secret = response.data["clientSecret"]
        assert len(new_secret) == len(old_secret)
        assert new_secret != old_secret
