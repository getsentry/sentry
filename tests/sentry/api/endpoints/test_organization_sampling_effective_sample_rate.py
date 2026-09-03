import pytest
from django.utils import timezone

from sentry.snuba.metrics.naming_layer.mri import SpanMRI
from sentry.testutils.cases import APITestCase, BaseMetricsLayerTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class OrganizationSamplingEffectiveSampleRateEndpointTest(
    APITestCase, BaseMetricsLayerTestCase, SpanTestCase
):
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

        # One stored segment sampled at 1/2 extrapolates to 2 received segments → EAP rate = 1/2
        self.store_spans(
            [
                self.create_span(
                    {"is_segment": True},
                    organization=self.organization,
                    project=project,
                    start_ts=before_now(minutes=15),
                    measurements={"server_sample_rate": {"value": 0.5}},
                )
            ]
        )

        # 4 root segments, 1 of them kept → generic metrics rate = 1/4
        for decision in ["drop", "drop", "drop", "keep"]:
            self.store_performance_metric(
                name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "foo_transaction", "decision": decision, "is_segment": "true"},
                minutes_before_now=1,
                value=1,
                project_id=project.id,
                org_id=self.organization.id,
            )

        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data["effectiveSampleRate"] == pytest.approx(0.25, rel=1e-6)
        assert response.data["eapEffectiveSampleRate"] == pytest.approx(0.5, rel=1e-6)

    def test_no_data(self) -> None:
        self.create_project(teams=[self.team])

        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data == {
            "effectiveSampleRate": None,
            "eapEffectiveSampleRate": None,
        }
