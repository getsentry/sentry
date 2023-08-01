from django.urls import reverse

from sentry.testutils.cases import APITestCase


class SystemHealthTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user, superuser=True)
        url = reverse("sentry-api-0-system-health")
        response = self.client.get(url)
        assert response.status_code == 200
        assert "problems" in response.data
        assert "healthy" in response.data
