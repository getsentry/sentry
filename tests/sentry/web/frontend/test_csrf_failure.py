from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class CsrfFailureTest(TestCase):
    def test_simple(self) -> None:
        path = reverse("error-403-csrf-failure")

        resp = self.client.get(path)
        assert resp.status_code == 403
        self.assertTemplateUsed(resp, "sentry/403-csrf-failure.html")
