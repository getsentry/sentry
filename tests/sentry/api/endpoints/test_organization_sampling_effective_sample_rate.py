import pytest

from sentry.testutils.cases import APITestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationSamplingEffectiveSampleRateEndpointTest(APITestCase, SnubaTestCase, SpanTestCase):
    endpoint = "sentry-api-0-organization-sampling-effective-sample-rate"
    method = "GET"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_without_feature(self) -> None:
        self.get_error_response(self.organization.slug, status_code=404)

    def test_get(self) -> None:
        project = self.create_project(teams=[self.team])

        # One stored segment sampled at 1/2 extrapolates to 2 received segments → rate = 1/2
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

        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data == {"eapEffectiveSampleRate": pytest.approx(0.5, rel=1e-6)}

    def test_no_data(self) -> None:
        self.create_project(teams=[self.team])

        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data == {"eapEffectiveSampleRate": None}
