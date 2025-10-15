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

    def test_redirect_uris_with_allowed_schemes(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])

        # Test allowed schemes - all must use :// format
        allowed_uris = [
            "http://example.com/callback",
            "https://example.com/callback",
            "sentry-mobile-agent://callback",
            "sentry-mobile-agent://callback/path",
        ]

        response = self.client.put(url, data={"redirectUris": allowed_uris})
        assert response.status_code == 200, (response.status_code, response.content)

        app = ApiApplication.objects.get(id=app.id)
        saved_uris = app.get_redirect_uris()
        assert len(saved_uris) == 4
        assert "http://example.com/callback" in saved_uris
        assert "https://example.com/callback" in saved_uris
        assert "sentry-mobile-agent://callback" in saved_uris
        assert "sentry-mobile-agent://callback/path" in saved_uris

    def test_invalid_redirect_uris_rejected(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])

        # Test invalid URIs
        invalid_uris = [
            "not-a-url",  # No scheme or netloc
            "://missing-scheme.com",  # No scheme
            "http://",  # http with no domain
            "https://",  # https with no domain
            "sentry-mobile-agent://",  # Custom scheme with no content after ://
            "sentry-mobile-agent:",  # Missing ://
            "sentry-mobile-agent:/callback",  # Single slash format not allowed
            "",  # Empty string should be rejected
        ]

        response = self.client.put(url, data={"redirectUris": invalid_uris})
        assert response.status_code == 400, (response.status_code, response.content)
        assert "redirectUris" in response.data

    def test_disallowed_schemes_rejected(self) -> None:
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])

        # Test schemes that are not in the allowlist
        disallowed_uris = [
            # Dangerous schemes
            "javascript:alert('xss')",
            "vbscript:msgbox('xss')",
            "data:text/html,<script>alert('xss')</script>",
            "file:///etc/passwd",
            # Database connections
            "jdbc:mysql://localhost:3306/db",
            "odbc:DSN=myDataSource",
            # Administrative/system
            "admin://system",
            "rdar://problem/12345",
            "shortcuts://run-shortcut?name=test",
            # Communication
            "mailto:test@example.com",
            "tel:+1234567890",
            "sms:+1234567890",
            # File transfer
            "ftp://example.com/file",
            "ftps://example.com/file",
            "sftp://example.com/file",
            # Custom schemes not in allowlist
            "myapp://callback",
            "com.example.app://auth",
            "custom-scheme://redirect",
        ]

        for disallowed_uri in disallowed_uris:
            response = self.client.put(url, data={"redirectUris": [disallowed_uri]})
            assert response.status_code == 400, (
                f"Expected {disallowed_uri} to be rejected",
                response.status_code,
                response.content,
            )
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
