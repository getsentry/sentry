from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


class ReportingApiExperimentTest(APITestCase):
    endpoint = "sentry-api-0-reporting-api-experiment"

    def test_disabled_by_default(self):
        """Test that the endpoint returns 404 when the option is disabled (default)."""
        response = self.client.post(reverse(self.endpoint))
        assert response.status_code == 404

    @override_options({"api.reporting-api-experiment.enabled": True})
    def test_enabled_option(self):
        """Test that the endpoint returns 200 when the option is enabled."""
        response = self.client.post(reverse(self.endpoint))
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    @override_options({"api.reporting-api-experiment.enabled": False})
    def test_explicitly_disabled(self):
        """Test that the endpoint returns 404 when the option is explicitly disabled."""
        response = self.client.post(reverse(self.endpoint))
        assert response.status_code == 404

    def test_no_authentication_required(self):
        """Test that the endpoint doesn't require authentication."""
        # This test verifies that we can call the endpoint without being logged in
        # and it only fails because of the option being disabled, not auth
        response = self.client.post(reverse(self.endpoint))
        assert response.status_code == 404  # Should be 404 due to option, not 401/403

    @override_options({"api.reporting-api-experiment.enabled": True})
    def test_accepts_post_data(self):
        """Test that the endpoint accepts POST data."""
        response = self.client.post(
            reverse(self.endpoint), data={"report": "some data"}, content_type="application/json"
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
