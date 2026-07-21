from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.exceptions import ObjectDoesNotExist

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.configuration import (
    AutomaticDynamicSamplingConfiguration,
    CustomDynamicSamplingOrganizationConfiguration,
    CustomDynamicSamplingProjectConfiguration,
    NoDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.telemetry import (
    DynamicSamplingException,
    DynamicSamplingStatus,
)
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.tasks.helpers.sliding_window import FALLBACK_SLIDING_WINDOW_SIZE
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase

GET_BLENDED_SAMPLE_RATE = (
    "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate"
)


class SamplingMeasureSelectionTest(TestCase):
    """The measure is shared base-class logic; it is tested once here instead of in
    every configuration test."""

    def _get_configuration(self, org: Organization) -> AutomaticDynamicSamplingConfiguration:
        with patch(GET_BLENDED_SAMPLE_RATE, return_value=1.0):
            configuration = get_configuration(org.id)
        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        return configuration

    def test_defaults_to_segments_when_span_option_disabled(self) -> None:
        org = self.create_organization()

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": False,
                "dynamic-sampling.measure.spans": [org.id],
            }
        ):
            configuration = self._get_configuration(org)

        assert configuration.measure == SamplingMeasure.SEGMENTS
        assert configuration.is_segment_based
        assert not configuration.is_span_based

    def test_segments_when_org_not_in_span_option(self) -> None:
        org = self.create_organization()

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [],
            }
        ):
            configuration = self._get_configuration(org)

        assert configuration.measure == SamplingMeasure.SEGMENTS

    def test_spans_when_org_in_span_option(self) -> None:
        org = self.create_organization()

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [org.id],
            }
        ):
            configuration = self._get_configuration(org)

        assert configuration.measure == SamplingMeasure.SPANS
        assert configuration.is_span_based
        assert not configuration.is_segment_based


class DynamicSamplingOrgConfigurationTest(TestCase):
    def test_subscription_backed_org_uses_blended_sample_rate(self) -> None:
        org = self.create_organization()

        with patch(GET_BLENDED_SAMPLE_RATE, return_value=0.5) as get_blended_sample_rate:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.is_enabled
        assert configuration.sample_rate == 0.5
        assert configuration.project_sample_rates == {}
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        assert configuration.get_sample_rate() == 0.5

    def test_subscription_backed_org_uses_outcomes_sliding_window_sample_rate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        sliding_window_volume = OrganizationDataVolume(org_id=org.id, total=1000, indexed=250)

        with (
            patch(GET_BLENDED_SAMPLE_RATE, return_value=0.5),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=sliding_window_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.compute_sliding_window_sample_rate",
                return_value=0.25,
            ) as compute_sample_rate,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.25
        # Blended rate is below 100%, so serving is not gated and matches the usage rate.
        assert configuration.get_serving_sample_rate() == 0.25
        get_volume.assert_called_once()
        assert get_volume.call_args.kwargs["time_interval"] == timedelta(
            hours=FALLBACK_SLIDING_WINDOW_SIZE
        )
        compute_sample_rate.assert_called_once_with(
            org_id=org.id,
            project_id=None,
            total_root_count=1000,
            window_size=FALLBACK_SLIDING_WINDOW_SIZE,
        )

    def test_blended_full_sample_rate_gates_only_the_serving_rate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        sliding_window_volume = OrganizationDataVolume(org_id=org.id, total=1000, indexed=250)

        with (
            patch(GET_BLENDED_SAMPLE_RATE, return_value=1.0),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=sliding_window_volume,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.compute_sliding_window_sample_rate",
                return_value=0.25,
            ),
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        # get_sample_rate stays ungated so balancing + comparison align with the legacy cache,
        # which is also ungated (usage-based).
        assert configuration.get_sample_rate() == 0.25
        # The blended-100% gate applies only at serve time, mirroring legacy serving.
        assert configuration.get_serving_sample_rate() == 1.0

    def test_subscription_backed_org_falls_back_to_blended_sample_rate_without_volume(
        self,
    ) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch(GET_BLENDED_SAMPLE_RATE, return_value=0.5),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.compute_sliding_window_sample_rate",
            ) as compute_sample_rate,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.5
        compute_sample_rate.assert_not_called()

    def test_subscription_backed_org_without_sample_rate_is_disabled(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch(GET_BLENDED_SAMPLE_RATE, return_value=None),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
            ) as get_volume,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, NoDynamicSamplingConfiguration)
        assert not configuration.is_enabled
        assert configuration.get_sample_rate() is None
        get_volume.assert_not_called()

    def test_subscription_backed_org_without_subscription_bubbles_terminal_status(self) -> None:
        org = self.create_organization()

        with (
            patch(GET_BLENDED_SAMPLE_RATE, side_effect=ObjectDoesNotExist),
            pytest.raises(DynamicSamplingException) as exc_info,
        ):
            get_configuration(org.id)

        assert exc_info.value.status == DynamicSamplingStatus.NO_SUBSCRIPTION

    def test_am2_ignores_project_mode_option(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with patch(GET_BLENDED_SAMPLE_RATE, return_value=0.5):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.sample_rate == 0.5
        assert configuration.project_sample_rates == {}

    def test_org_mode_custom_dynamic_sampling_uses_org_target_sample_rate(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:target_sample_rate", 0.3)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(GET_BLENDED_SAMPLE_RATE) as get_blended_sample_rate,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingOrganizationConfiguration)
        assert configuration.is_enabled
        assert configuration.sample_rate == 0.3
        assert configuration.get_sample_rate() == 0.3
        assert configuration.get_project_sample_rates() == {}
        get_blended_sample_rate.assert_not_called()

    def test_project_mode_custom_dynamic_sampling_stores_project_sample_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project_without_rate = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(GET_BLENDED_SAMPLE_RATE) as get_blended_sample_rate,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert configuration.is_enabled
        assert configuration.get_project_sample_rates() == {
            project.id: 0.2,
            project_without_rate.id: None,
        }
        assert configuration.get_sample_rate() is None
        get_blended_sample_rate.assert_not_called()

    def test_project_mode_custom_dynamic_sampling_without_project_rates_is_disabled(
        self,
    ) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert not configuration.is_enabled
        assert configuration.get_project_sample_rates() == {project.id: None}

    def test_project_mode_custom_dynamic_sampling_without_projects_is_disabled(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert not configuration.is_enabled
        assert configuration.get_project_sample_rates() == {}


class GetProjectSampleRatesTest(TestCase):
    def test_no_dynamic_sampling_returns_empty(self) -> None:
        configuration = NoDynamicSamplingConfiguration()

        assert configuration.get_project_sample_rates() == {}

    def test_rebalanced_project_rates_round_trip(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        org.update_option("sentry:target_sample_rate", 0.5)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingOrganizationConfiguration)
        configuration.set_rebalanced_project_sample_rates(
            [
                RebalancedItem(id=project_a.id, count=100, new_sample_rate=0.3),
                RebalancedItem(id=project_b.id, count=20, new_sample_rate=0.9),
            ]
        )
        assert configuration.get_project_sample_rates() == {
            project_a.id: 0.3,
            project_b.id: 0.9,
        }

    def test_does_not_fall_back_to_org_sample_rate_without_rebalancing(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        org.update_option("sentry:target_sample_rate", 0.5)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingOrganizationConfiguration)
        assert configuration.get_sample_rate() == 0.5
        # Without rebalancing, project sample rates must stay empty rather than
        # falling back to the org-wide sample rate.
        assert configuration.get_project_sample_rates() == {}
