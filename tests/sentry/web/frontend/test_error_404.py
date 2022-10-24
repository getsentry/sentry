from django.test import override_settings
from django.urls import reverse

from sentry.testutils import TestCase
from sentry.testutils.silo import all_silo_test


@override_settings(ROOT_URLCONF="sentry.conf.urls")
@all_silo_test(stable=True)
class Error404Test(TestCase):
    def test_renders(self):
        resp = self.client.get(reverse("error-404"))
        assert resp.status_code == 404
        self.assertTemplateUsed(resp, "sentry/404.html")
