from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DynamicSamplingSimulateTest(APITestCase):
    def setUp(self):
        self.url = reverse(
            "sentry-api-0-internal-dynamic-sampling-simulate",
            args=[self.organization.slug],
        )
