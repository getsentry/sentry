from __future__ import annotations

from datetime import timedelta
from unittest.mock import DEFAULT, patch

import pytest
from django.core.exceptions import ObjectDoesNotExist

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.configuration import (
    AutomaticDynamicSamplingConfiguration,
    BaseDynamicSamplingConfiguration,
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
from sentry.testutils.cases import TestCase
from tests.sentry.dynamic_sampling.per_org.test_helpers import (
    BLENDED_SAMPLE_RATE,
    CALCULATE_FACTOR,
    GET_FACTOR,
    OUTCOMES_VOLUME,
    SET_FACTOR,
    SLIDING_WINDOW_RATE,
    patch_configuration,
)


def assert_measure(
    configuration: BaseDynamicSamplingConfiguration, expected: SamplingMeasure
) -> None:
    assert configuration.measure == expected
    assert configuration.is_span_based == (expected == SamplingMeasure.SPANS)
    assert configuration.is_segment_based == (expected == SamplingMeasure.SEGMENTS)


class DynamicSamplingOrgConfigurationTest(TestCase):
    def test_subscription_backed_org_uses_blended_sample_rate(self) -> None:
        org = self.create_organization()

        with patch_configuration({BLENDED_SAMPLE_RATE: 0.5}) as mocks:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.is_enabled
        assert_measure(configuration, SamplingMeasure.SEGMENTS)
        assert configuration.sample_rate == 0.5
        assert configuration.project_sample_rates == {}
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        assert configuration.get_sample_rate() == 0.5

    def test_subscription_backed_org_uses_outcomes_sliding_window_sample_rate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        sliding_window_volume = OrganizationDataVolume(org_id=org.id, total=1000, indexed=250)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                OUTCOMES_VOLUME: sliding_window_volume,
                SLIDING_WINDOW_RATE: 0.25,
            }
        ) as mocks:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.25
        # Blended rate is below 100%, so serving is not gated and matches the usage rate.
        assert configuration.get_serving_sample_rate() == 0.25
        mocks[OUTCOMES_VOLUME].assert_called_once()
        assert mocks[OUTCOMES_VOLUME].call_args.kwargs["time_interval"] == timedelta(
            hours=FALLBACK_SLIDING_WINDOW_SIZE
        )
        mocks[SLIDING_WINDOW_RATE].assert_called_once_with(
            org_id=org.id,
            project_id=None,
            total_root_count=1000,
            window_size=FALLBACK_SLIDING_WINDOW_SIZE,
        )

    def test_blended_full_sample_rate_gates_only_the_serving_rate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        sliding_window_volume = OrganizationDataVolume(org_id=org.id, total=1000, indexed=250)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                OUTCOMES_VOLUME: sliding_window_volume,
                SLIDING_WINDOW_RATE: 0.25,
            }
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

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                OUTCOMES_VOLUME: None,
                SLIDING_WINDOW_RATE: DEFAULT,
            }
        ) as mocks:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.5
        mocks[SLIDING_WINDOW_RATE].assert_not_called()

    def test_subscription_backed_org_calculates_recalibration_factor(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                OUTCOMES_VOLUME: None,
                GET_FACTOR: 1.4,
                SET_FACTOR: DEFAULT,
                CALCULATE_FACTOR: 0.7,
            }
        ) as mocks:
            configuration = get_configuration(org.id)

            configuration.recalibrate(org_volume)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.results.recalibration_factor == 0.7
        assert configuration.results.previous_recalibration_factor == 1.4
        mocks[GET_FACTOR].assert_called_once_with(org.id)
        mocks[CALCULATE_FACTOR].assert_called_once_with(org_volume, 1.4, 0.5)
        mocks[SET_FACTOR].assert_not_called()

    def test_subscription_backed_org_skips_recalibration_without_an_org_volume(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                OUTCOMES_VOLUME: None,
                GET_FACTOR: 1.0,
            }
        ):
            configuration = get_configuration(org.id)

            configuration.recalibrate(None)

        assert configuration.results.recalibration_factor is None

    def test_subscription_backed_org_records_a_recalibration_factor_out_of_bounds(
        self,
    ) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=1)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                OUTCOMES_VOLUME: None,
                GET_FACTOR: 1.0,
            }
        ):
            configuration = get_configuration(org.id)

            configuration.recalibrate(org_volume)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        # Recorded as computed, so the comparison log reports it. write_caches is what
        # rejects it against the rebalance bounds.
        assert configuration.results.recalibration_factor == 50.0

    def test_subscription_backed_org_leaves_recalibration_factor_when_not_computed(
        self,
    ) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                OUTCOMES_VOLUME: None,
                GET_FACTOR: 1.0,
                CALCULATE_FACTOR: None,
            }
        ):
            configuration = get_configuration(org.id)

            configuration.recalibrate(org_volume)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.results.recalibration_factor is None

    def test_building_configuration_does_not_recalibrate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                OUTCOMES_VOLUME: None,
                GET_FACTOR: DEFAULT,
            }
        ) as mocks:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.results.recalibration_factor is None
        mocks[GET_FACTOR].assert_not_called()

    def test_org_mode_custom_dynamic_sampling_recalibrates_against_target_sample_rate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org.update_option("sentry:target_sample_rate", 0.3)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_configuration(
                {
                    GET_FACTOR: 1.2,
                    CALCULATE_FACTOR: 0.9,
                }
            ) as mocks,
        ):
            configuration = get_configuration(org.id)

            configuration.recalibrate(org_volume)

        assert isinstance(configuration, CustomDynamicSamplingOrganizationConfiguration)
        assert configuration.results.recalibration_factor == 0.9
        mocks[CALCULATE_FACTOR].assert_called_once_with(org_volume, 1.2, 0.3)

    def test_project_mode_custom_dynamic_sampling_does_not_recalibrate(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_configuration({GET_FACTOR: DEFAULT}) as mocks,
        ):
            configuration = get_configuration(org.id)

            configuration.recalibrate(org_volume)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert configuration.results.recalibration_factor is None
        mocks[GET_FACTOR].assert_not_called()

    def test_subscription_backed_org_without_sample_rate_is_disabled(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with patch_configuration({BLENDED_SAMPLE_RATE: None, OUTCOMES_VOLUME: DEFAULT}) as mocks:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, NoDynamicSamplingConfiguration)
        assert not configuration.is_enabled
        mocks[OUTCOMES_VOLUME].assert_not_called()
        with pytest.raises(AttributeError):
            getattr(configuration, "measure")
        assert configuration.sample_rate is None

    def test_subscription_backed_org_without_subscription_bubbles_terminal_status(self) -> None:
        org = self.create_organization()

        with (
            patch(BLENDED_SAMPLE_RATE, side_effect=ObjectDoesNotExist),
            pytest.raises(DynamicSamplingException) as exc_info,
        ):
            get_configuration(org.id)

        assert exc_info.value.status == DynamicSamplingStatus.NO_SUBSCRIPTION

    def test_am2_ignores_project_mode_option(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with patch_configuration({BLENDED_SAMPLE_RATE: 0.5}):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.sample_rate == 0.5
        assert configuration.project_sample_rates == {}

    def test_org_mode_custom_dynamic_sampling_uses_org_target_sample_rate(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:target_sample_rate", 0.3)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_configuration({BLENDED_SAMPLE_RATE: DEFAULT}) as mocks,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingOrganizationConfiguration)
        assert configuration.is_enabled
        assert_measure(configuration, SamplingMeasure.SEGMENTS)
        assert configuration.sample_rate == 0.3
        assert configuration.get_sample_rate() == 0.3
        assert configuration.project_sample_rates == {}
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()

    def test_project_mode_custom_dynamic_sampling_stores_project_sample_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project_without_rate = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_configuration({BLENDED_SAMPLE_RATE: DEFAULT}) as mocks,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert configuration.is_enabled
        assert_measure(configuration, SamplingMeasure.SEGMENTS)
        assert configuration.project_sample_rates == {
            project.id: 0.2,
            project_without_rate.id: None,
        }
        assert configuration.get_sample_rate() is None
        assert configuration.sample_rate is None
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()

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
        assert configuration.measure == SamplingMeasure.SEGMENTS
        assert configuration.project_sample_rates == {project.id: None}
        assert configuration.sample_rate is None

    def test_project_mode_custom_dynamic_sampling_without_projects_is_disabled(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert not configuration.is_enabled
        assert configuration.measure == SamplingMeasure.SEGMENTS
        assert configuration.project_sample_rates == {}
        assert configuration.sample_rate is None


class GetProjectSampleRatesTest(TestCase):
    def test_no_dynamic_sampling_returns_empty(self) -> None:
        configuration = NoDynamicSamplingConfiguration()

        assert configuration.get_project_sample_rates() == {}

    def test_project_mode_returns_target_sample_rates(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project_a.update_option("sentry:target_sample_rate", 0.2)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert configuration.get_project_sample_rates() == {
            project_a.id: 0.2,
            project_b.id: None,
        }

    def test_org_mode_uses_rebalanced_project_rates(self) -> None:
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

    def test_org_mode_does_not_fall_back_to_org_sample_rate(self) -> None:
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

    def test_automatic_mode_uses_rebalanced_project_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)

        with patch_configuration({BLENDED_SAMPLE_RATE: 0.5}):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        configuration.set_rebalanced_project_sample_rates(
            [RebalancedItem(id=project.id, count=100, new_sample_rate=0.4)]
        )
        assert configuration.get_project_sample_rates() == {project.id: 0.4}

    def test_automatic_mode_does_not_fall_back_to_org_sample_rate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        self.create_project(organization=org)

        with patch_configuration({BLENDED_SAMPLE_RATE: 0.5}):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.5
        # Without rebalancing, project sample rates must stay empty rather than
        # falling back to the org-wide sample rate.
        assert configuration.get_project_sample_rates() == {}
