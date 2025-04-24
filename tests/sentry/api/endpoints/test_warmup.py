from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from sentry.testutils.cases import APITestCase


class WarmupEndpointTest(APITestCase):
    def test_warmup_endpoint(self):
        url = reverse("sentry-warmup")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_warmup_endpoint_with_incorrect_basehost(self):
        url = reverse("sentry-warmup")
        with (
            override_settings(ALLOWED_HOSTS=[".sentry.io"]),
            self.options({"system.base-hostname": "sentry.io"}),
        ):
            response = self.client.get(url, HTTP_HOST="example.com")
        assert response.status_code == status.HTTP_302_FOUND

    def test_warmup_endpoint_with_basehost(self):
        url = reverse("sentry-warmup")
        with (
            override_settings(ALLOWED_HOSTS=[".sentry.io"]),
            self.options({"system.base-hostname": "sentry.io"}),
        ):
            response = self.client.get(url, HTTP_HOST="sentry.io")
        assert response.status_code == status.HTTP_200_OK
