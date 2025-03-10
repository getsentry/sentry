from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class TestSecurityTxt(TestCase):
    def test_simple(self):
        response = self.client.get(reverse("sentry-security-txt"))

        assert response.status_code == 200
        assert b"Contact: security@sentry.io" in response.content
        assert response["Content-Type"] == "text/plain"
