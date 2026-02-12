from django.urls import reverse

from sentry.models.apiapplication import ApiApplication
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


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

    def test_create_confidential_client(self) -> None:
        """Creating an app without isPublic flag creates a confidential client with secret."""
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-applications")
        response = self.client.post(url, data={"isPublic": False})
        assert response.status_code == 201
        assert response.data["isPublic"] is False

        app = ApiApplication.objects.get(client_id=response.data["id"])
        assert app.client_secret is not None
        assert not app.is_public

    def test_create_public_client(self) -> None:
        """Creating an app with isPublic=True creates a public client without secret."""
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-applications")
        response = self.client.post(url, data={"isPublic": True})
        assert response.status_code == 201
        assert response.data["isPublic"] is True
        # clientSecret should be None for public clients
        assert response.data["clientSecret"] is None

        app = ApiApplication.objects.get(client_id=response.data["id"])
        assert app.client_secret is None
        assert app.is_public
