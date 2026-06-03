from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from typing import NamedTuple
from unittest.mock import patch

import pytest
from django.core.exceptions import ObjectDoesNotExist

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

SpanOrgIds = Callable[[Organization], list[int]]


class MeasureOptionCase(NamedTuple):
    name: str
    check_span_feature_flag: bool
    span_org_ids: SpanOrgIds
    expected_measure: SamplingMeasure


def _include_org(organization: Organization) -> list[int]:
    return [organization.id]


def _exclude_org(organization: Organization) -> list[int]:
    return []


MEASURE_OPTION_CASES = (
    MeasureOptionCase("span-option-disabled", False, _include_org, SamplingMeasure.SEGMENTS),
    MeasureOptionCase("org-not-in-span-option", True, _exclude_org, SamplingMeasure.SEGMENTS),
    MeasureOptionCase("org-in-span-option", True, _include_org, SamplingMeasure.SPANS),
)


class DynamicSamplingOrgConfigurationTest(TestCase):
    def test_subscription_backed_org_uses_blended_sample_rate(self) -> None:
        org = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
            return_value=0.5,
        ) as get_blended_sample_rate:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.is_enabled
        assert configuration.measure == SamplingMeasure.SEGMENTS
        assert configuration.is_segment_based
        assert not configuration.is_span_based
        assert configuration.sample_rate == 0.5
        assert configuration.project_sample_rates == {}
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        assert configuration.get_sample_rate() == 0.5

    def test_subscription_backed_org_uses_eap_sliding_window_sample_rate(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        sliding_window_volume = OrganizationDataVolume(org_id=org.id, total=1000, indexed=250)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=sliding_window_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.compute_sliding_window_sample_rate",
                return_value=0.25,
            ) as compute_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.25
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

    def test_subscription_backed_org_falls_back_to_blended_sample_rate_without_volume(
        self,
    ) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.compute_sliding_window_sample_rate",
            ) as compute_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.5
        compute_sample_rate.assert_not_called()

    def test_subscription_backed_org_calculates_recalibration_factor(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=org_volume,
            ) as get_outcome_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
                return_value=1.1,
            ) as get_legacy_factor,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
                return_value=1.4,
            ) as get_per_org_factor,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.set_guarded_adjusted_factor",
            ) as set_per_org_factor,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.calculate_recalibration_factor",
                return_value=0.7,
            ) as calculate_factor,
            patch("sentry.dynamic_sampling.per_org.configuration.logger.info") as logger_info,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.organization_recalibration_factor == 0.7
        get_outcome_volume.assert_called_once()
        get_legacy_factor.assert_called_once_with(org.id)
        get_per_org_factor.assert_called_once_with(org.id)
        calculate_factor.assert_called_once_with(org_volume, 1.4, 0.5)
        set_per_org_factor.assert_called_once_with(org.id, 0.7)
        logger_info.assert_called_once_with(
            "dynamic_sampling.per_org.recalibration_factor_discrepancy",
            extra={
                "org_id": org.id,
                "discrepancy": pytest.approx(0.3),
                "old_pipeline_factor": 1.1,
                "new_pipeline_factor": 1.4,
                "sample_rate": 0.5,
            },
        )

    def test_subscription_backed_org_deletes_recalibration_factor_when_out_of_bounds(
        self,
    ) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=1)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=org_volume,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.delete_adjusted_factor",
            ) as delete_per_org_factor,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.set_guarded_adjusted_factor",
            ) as set_per_org_factor,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.organization_recalibration_factor is None
        delete_per_org_factor.assert_called_once_with(org.id)
        set_per_org_factor.assert_not_called()

    def test_subscription_backed_org_leaves_recalibration_factor_when_not_computed(
        self,
    ) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=org_volume,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.calculate_recalibration_factor",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.delete_adjusted_factor",
            ) as delete_per_org_factor,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.set_guarded_adjusted_factor",
            ) as set_per_org_factor,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.organization_recalibration_factor is None
        delete_per_org_factor.assert_not_called()
        set_per_org_factor.assert_not_called()

    def test_subscription_backed_org_without_sample_rate_is_disabled(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
            ) as get_volume,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, NoDynamicSamplingConfiguration)
        assert not configuration.is_enabled
        get_volume.assert_not_called()
        with pytest.raises(AttributeError):
            getattr(configuration, "measure")
        assert configuration.sample_rate is None

    def test_subscription_backed_org_without_subscription_bubbles_terminal_status(self) -> None:
        org = self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                side_effect=ObjectDoesNotExist,
            ),
            pytest.raises(DynamicSamplingException) as exc_info,
        ):
            get_configuration(org.id)

        assert exc_info.value.status == DynamicSamplingStatus.NO_SUBSCRIPTION

    def test_am2_ignores_project_mode_option(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with patch(
            "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
            return_value=0.5,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.sample_rate == 0.5
        assert configuration.project_sample_rates == {}

    def test_org_mode_custom_dynamic_sampling_uses_org_target_sample_rate(self) -> None:
        for measure_case in MEASURE_OPTION_CASES:
            with self.subTest(measure_case=measure_case.name):
                org = self.create_organization()
                org.update_option("sentry:target_sample_rate", 0.3)

                with (
                    self.feature("organizations:dynamic-sampling-custom"),
                    self.options(
                        {
                            "dynamic-sampling.check_span_feature_flag": measure_case.check_span_feature_flag,
                            "dynamic-sampling.measure.spans": measure_case.span_org_ids(org),
                        }
                    ),
                    patch(
                        "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate"
                    ) as get_blended_sample_rate,
                ):
                    configuration = get_configuration(org.id)

                assert isinstance(configuration, CustomDynamicSamplingOrganizationConfiguration)
                assert configuration.is_enabled
                assert configuration.measure == measure_case.expected_measure
                assert configuration.is_span_based == (
                    measure_case.expected_measure == SamplingMeasure.SPANS
                )
                assert configuration.is_segment_based == (
                    measure_case.expected_measure == SamplingMeasure.SEGMENTS
                )
                assert configuration.sample_rate == 0.3
                assert configuration.get_sample_rate() == 0.3
                assert configuration.project_sample_rates == {}
                get_blended_sample_rate.assert_not_called()

    def test_project_mode_custom_dynamic_sampling_stores_project_sample_rates(self) -> None:
        for measure_case in MEASURE_OPTION_CASES:
            with self.subTest(measure_case=measure_case.name):
                org = self.create_organization()
                project = self.create_project(organization=org)
                project_without_rate = self.create_project(organization=org)
                org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
                project.update_option("sentry:target_sample_rate", 0.2)

                with (
                    self.feature("organizations:dynamic-sampling-custom"),
                    self.options(
                        {
                            "dynamic-sampling.check_span_feature_flag": measure_case.check_span_feature_flag,
                            "dynamic-sampling.measure.spans": measure_case.span_org_ids(org),
                        }
                    ),
                    patch(
                        "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate"
                    ) as get_blended_sample_rate,
                ):
                    configuration = get_configuration(org.id)

                assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
                assert configuration.is_enabled
                assert configuration.measure == measure_case.expected_measure
                assert configuration.is_span_based == (
                    measure_case.expected_measure == SamplingMeasure.SPANS
                )
                assert configuration.is_segment_based == (
                    measure_case.expected_measure == SamplingMeasure.SEGMENTS
                )
                assert configuration.project_sample_rates == {
                    project.id: 0.2,
                    project_without_rate.id: None,
                }
                assert configuration.get_sample_rate() is None
                assert configuration.sample_rate is None
                get_blended_sample_rate.assert_not_called()

    def test_project_mode_custom_dynamic_sampling_without_project_rates_is_disabled(
        self,
    ) -> None:
        for measure_case in MEASURE_OPTION_CASES:
            with self.subTest(measure_case=measure_case.name):
                org = self.create_organization()
                project = self.create_project(organization=org)
                org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

                with (
                    self.feature("organizations:dynamic-sampling-custom"),
                    self.options(
                        {
                            "dynamic-sampling.check_span_feature_flag": measure_case.check_span_feature_flag,
                            "dynamic-sampling.measure.spans": measure_case.span_org_ids(org),
                        }
                    ),
                ):
                    configuration = get_configuration(org.id)

                assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
                assert not configuration.is_enabled
                assert configuration.measure == measure_case.expected_measure
                assert configuration.project_sample_rates == {project.id: None}
                assert configuration.sample_rate is None

    def test_project_mode_custom_dynamic_sampling_without_projects_is_disabled(self) -> None:
        for measure_case in MEASURE_OPTION_CASES:
            with self.subTest(measure_case=measure_case.name):
                org = self.create_organization()
                org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

                with (
                    self.feature("organizations:dynamic-sampling-custom"),
                    self.options(
                        {
                            "dynamic-sampling.check_span_feature_flag": measure_case.check_span_feature_flag,
                            "dynamic-sampling.measure.spans": measure_case.span_org_ids(org),
                        }
                    ),
                ):
                    configuration = get_configuration(org.id)

                assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
                assert not configuration.is_enabled
                assert configuration.measure == measure_case.expected_measure
                assert configuration.project_sample_rates == {}
                assert configuration.sample_rate is None

    def test_subscription_backed_org_uses_measure_options(self) -> None:
        for measure_case in MEASURE_OPTION_CASES:
            with self.subTest(measure_case=measure_case.name):
                org = self.create_organization()

                with (
                    self.options(
                        {
                            "dynamic-sampling.check_span_feature_flag": measure_case.check_span_feature_flag,
                            "dynamic-sampling.measure.spans": measure_case.span_org_ids(org),
                        }
                    ),
                    patch(
                        "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                        return_value=1.0,
                    ),
                ):
                    configuration = get_configuration(org.id)

                assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
                assert configuration.is_enabled
                assert configuration.measure == measure_case.expected_measure
                assert configuration.is_span_based == (
                    measure_case.expected_measure == SamplingMeasure.SPANS
                )
                assert configuration.is_segment_based == (
                    measure_case.expected_measure == SamplingMeasure.SEGMENTS
                )
                assert configuration.sample_rate == 1.0


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

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingProjectConfiguration)
        assert configuration.get_project_sample_rates() == {
            project_a.id: 0.2,
            project_b.id: None,
        }

    def test_org_mode_uses_rebalanced_project_rates(self) -> None:
        from sentry.dynamic_sampling.models.common import RebalancedItem

        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        org.update_option("sentry:target_sample_rate", 0.5)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
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

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, CustomDynamicSamplingOrganizationConfiguration)
        assert configuration.get_sample_rate() == 0.5
        # Without rebalancing, project sample rates must stay empty rather than
        # falling back to the org-wide sample rate.
        assert configuration.get_project_sample_rates() == {}

    def test_automatic_mode_uses_rebalanced_project_rates(self) -> None:
        from sentry.dynamic_sampling.models.common import RebalancedItem

        org = self.create_organization()
        project = self.create_project(organization=org)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
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

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.get_sample_rate() == 0.5
        # Without rebalancing, project sample rates must stay empty rather than
        # falling back to the org-wide sample rate.
        assert configuration.get_project_sample_rates() == {}
