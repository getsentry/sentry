from django.test import Client
from django.urls import reverse

from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
def test_healthcheck_endpoint():
    c = Client()
    url = reverse("sentry-api-0-relays-healthcheck")
    response = c.get(url)
    assert response.status_code == 200
