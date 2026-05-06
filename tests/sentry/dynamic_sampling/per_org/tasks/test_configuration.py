from __future__ import annotations

from collections.abc import Callable
from typing import NamedTuple
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.per_org.tasks.configuration import (
    AutomaticDynamicSamplingConfiguration,
    CustomDynamicSamplingOrganizationConfiguration,
    CustomDynamicSamplingProjectConfiguration,
    NoDynamicSamplingConfiguration,
    get_configuration,
)
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
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=0.5,
        ) as get_blended_sample_rate:
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.is_enabled
        assert configuration.measure == SamplingMeasure.SEGMENTS
        assert configuration.is_segment_based
        assert not configuration.is_span_based
        assert configuration.sample_rate == 0.5
        with pytest.raises(AttributeError):
            getattr(configuration, "project_target_sample_rates")
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)

    def test_subscription_backed_org_without_sample_rate_is_disabled(self) -> None:
        org = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=None,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, NoDynamicSamplingConfiguration)
        assert not configuration.is_enabled
        with pytest.raises(AttributeError):
            getattr(configuration, "measure")
        with pytest.raises(AttributeError):
            getattr(configuration, "sample_rate")

    def test_am2_ignores_project_mode_option(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=0.5,
        ):
            configuration = get_configuration(org.id)

        assert isinstance(configuration, AutomaticDynamicSamplingConfiguration)
        assert configuration.sample_rate == 0.5
        with pytest.raises(AttributeError):
            getattr(configuration, "project_target_sample_rates")

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
                        "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate"
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
                with pytest.raises(AttributeError):
                    getattr(configuration, "project_target_sample_rates")
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
                        "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate"
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
                assert configuration.project_target_sample_rates == {
                    project.id: 0.2,
                    project_without_rate.id: None,
                }
                with pytest.raises(AttributeError):
                    getattr(configuration, "sample_rate")
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
                assert configuration.project_target_sample_rates == {project.id: None}
                with pytest.raises(AttributeError):
                    getattr(configuration, "sample_rate")

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
                assert configuration.project_target_sample_rates == {}
                with pytest.raises(AttributeError):
                    getattr(configuration, "sample_rate")

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
                        "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
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
