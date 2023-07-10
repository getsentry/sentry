from django.test import override_settings
from django.urls import reverse

from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@override_settings(ROOT_URLCONF="sentry.conf.urls")
@control_silo_test(stable=True)
class CsrfFailureTest(TestCase):
    def test_simple(self):
        path = reverse("error-403-csrf-failure")

        resp = self.client.get(path)
        assert resp.status_code == 403
        self.assertTemplateUsed(resp, "sentry/403-csrf-failure.html")
