from django.urls import reverse

from sentry.testutils import TestCase
from sentry.testutils.helpers.django import override_settings


@override_settings(ROOT_URLCONF="sentry.conf.urls")
class CsrfFailureTest(TestCase):
    def test_simple(self):
        path = reverse("error-403-csrf-failure")

        resp = self.client.get(path)
        assert resp.status_code == 403
        self.assertTemplateUsed(resp, "sentry/403-csrf-failure.html")
