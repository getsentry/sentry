from django.urls import reverse
from rest_framework import status

from sentry.testutils.cases import APITestCase


class WarmupEndpointTest(APITestCase):
    def test_warmup_endpoint(self):
        url = reverse("sentry-warmup")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
