from typing import int
import pytest
from django.utils import timezone

from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import APITestCase, BaseMetricsLayerTestCase

pytestmark = pytest.mark.sentry_metrics


class OrganizationSamplingEffectiveSampleRateEndpointTest(APITestCase, BaseMetricsLayerTestCase):
    endpoint = "sentry-api-0-organization-sampling-effective-sample-rate"
    method = "GET"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @property
    def now(self):
        # BaseMetricsLayerTestCase expects subclasses to provide a reference time
        return timezone.now()

    def test_without_feature(self) -> None:
        self.get_error_response(self.organization.slug, status_code=404)

    def test_get(self) -> None:
        project = self.create_project(teams=[self.team])

        # Create 3 root transactions in the last minute: 2 dropped, 1 kept → rate = 1/3
        for decision in ["drop", "drop", "keep"]:
            self.store_performance_metric(
                name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "foo_transaction", "decision": decision},
                minutes_before_now=1,
                value=1,
                project_id=project.id,
                org_id=self.organization.id,
            )

        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data["effectiveSampleRate"] == pytest.approx(1.0 / 3.0, rel=1e-6)

    def test_no_data(self) -> None:
        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data == {"effectiveSampleRate": None}
