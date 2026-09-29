from unittest.mock import patch

import pytest

from sentry.testutils.cases import APITestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


class OrganizationSamplingEffectiveSampleRateEndpointTest(APITestCase, SnubaTestCase, SpanTestCase):
    endpoint = "sentry-api-0-organization-sampling-effective-sample-rate"
    method = "GET"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def dynamic_sampling_enabled(self):
        return self.feature("organizations:dynamic-sampling")

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

        with self.dynamic_sampling_enabled():
            response = self.get_success_response(self.organization.slug)

        assert response.data == {"eapEffectiveSampleRate": pytest.approx(0.5, rel=1e-6)}

    def test_no_data(self) -> None:
        self.create_project(teams=[self.team])

        with self.dynamic_sampling_enabled():
            response = self.get_success_response(self.organization.slug)

        assert response.data == {"eapEffectiveSampleRate": None}


@with_feature(
    {
        "organizations:dynamic-sampling": False,
        "organizations:dynamic-sampling-platform-rate-rollover": True,
    }
)
class OrganizationSamplingEffectiveSampleRateRolloverTest(
    OrganizationSamplingEffectiveSampleRateEndpointTest
):
    def dynamic_sampling_enabled(self):
        return patch("sentry.quotas.backend.get_blended_sample_rate", return_value=0.5)

    def test_without_feature(self) -> None:
        with patch("sentry.quotas.backend.get_blended_sample_rate", return_value=None):
            self.get_error_response(self.organization.slug, status_code=404)
