from django.urls import reverse

from sentry.models.apiapplication import ApiApplication
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.useremail import UserEmail


@control_silo_test
class ApiApplicationsListTest(APITestCase):
    def test_simple(self) -> None:
        app1 = ApiApplication.objects.create(owner=self.user, name="a")
        app2 = ApiApplication.objects.create(owner=self.user, name="b")
        ApiApplication.objects.create(owner=self.create_user("foo@example.com"))

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-applications")
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["id"] == app1.client_id
        assert response.data[1]["id"] == app2.client_id


@control_silo_test
class ApiApplicationsCreateTest(APITestCase):
    def test_simple(self) -> None:
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-applications")
        response = self.client.post(url, data={})
        assert response.status_code == 201
        assert ApiApplication.objects.get(client_id=response.data["id"], owner=self.user)

    def test_unverified_user_cannot_create(self) -> None:
        # Mark user's email as unverified
        UserEmail.objects.filter(user=self.user, email=self.user.email).update(is_verified=False)

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-applications")
        response = self.client.post(url, data={})
        assert response.status_code == 403
        assert "verify your email" in response.data["detail"]
