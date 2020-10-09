from __future__ import absolute_import, print_function

from django.test import Client
from django.core.urlresolvers import reverse


def test_healthcheck_endpoint():
    c = Client()
    url = reverse("sentry-api-0-relays-healthcheck")
    response = c.get(url)
    assert response.status_code == 200
    print(response.data)
