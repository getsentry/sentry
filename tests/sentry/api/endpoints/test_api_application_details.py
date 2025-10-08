from django.urls import reverse

from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiApplicationDetailsTest(APITestCase):
    def test_simple(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.get(url)
        assert response.status_code == 200, (response.status_code, response.content)
        assert response.data["id"] == app.client_id


@control_silo_test
class ApiApplicationUpdateTest(APITestCase):
    def test_simple(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.put(url, data={"name": "foobaz"})
        assert response.status_code == 200, (response.status_code, response.content)
        assert response.data["id"] == app.client_id

        app = ApiApplication.objects.get(id=app.id)
        assert app.name == "foobaz"

    def test_redirect_uris_with_custom_schemes(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])

        # Test various custom schemes
        custom_uris = [
            "myapp://callback",
            "custom-scheme://auth/callback",
            "app123://redirect",
            "http://example.com/callback",  # Standard HTTP still works
            "https://example.com/callback",  # Standard HTTPS still works
        ]

        response = self.client.put(url, data={"redirectUris": custom_uris})
        assert response.status_code == 200, (response.status_code, response.content)

        app = ApiApplication.objects.get(id=app.id)
        saved_uris = app.get_redirect_uris()
        assert len(saved_uris) == 5
        assert "myapp://callback" in saved_uris
        assert "custom-scheme://auth/callback" in saved_uris
        assert "app123://redirect" in saved_uris
        assert "http://example.com/callback" in saved_uris
        assert "https://example.com/callback" in saved_uris

    def test_invalid_redirect_uris_rejected(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])

        # Test invalid URIs
        invalid_uris = [
            "not-a-url",  # No scheme or netloc
            "://missing-scheme.com",  # No scheme
            "scheme-only://",  # No netloc
        ]

        response = self.client.put(url, data={"redirectUris": invalid_uris})
        assert response.status_code == 400, (response.status_code, response.content)
        assert "redirectUris" in response.data


@control_silo_test
class ApiApplicationDeleteTest(APITestCase):
    def test_simple(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.delete(url)
        assert response.status_code == 204, response.content

        app = ApiApplication.objects.get(id=app.id)
        assert app.status == ApiApplicationStatus.pending_deletion
        assert ScheduledDeletion.objects.filter(
            object_id=app.id, model_name="ApiApplication"
        ).exists()
