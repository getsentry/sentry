from django.core.urlresolvers import reverse
from django.test import Client


def test_healthcheck_endpoint():
    c = Client()
    url = reverse("sentry-api-0-relays-healthcheck")
    response = c.get(url)
    assert response.status_code == 200
    print(response.data)
