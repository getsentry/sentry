from __future__ import annotations

from unittest.mock import patch

from sentry.dynamic_sampling.per_org.tasks.configuration import (
    DynamicSamplingGeneration,
    DynamicSamplingOrgConfiguration,
)
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DynamicSamplingOrgConfigurationTest(TestCase):
    def test_subscription_backed_org_uses_blended_sample_rate(self) -> None:
        org = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=0.5,
        ) as get_blended_sample_rate:
            configuration = DynamicSamplingOrgConfiguration(org)

        assert configuration.is_enabled
        assert configuration.generation == DynamicSamplingGeneration.AM2
        assert configuration.is_am2
        assert not configuration.is_am3
        assert configuration.is_organization_mode
        assert not configuration.is_project_mode
        assert not configuration.is_am3_organization_mode
        assert not configuration.is_am3_project_mode
        assert configuration.measure == SamplingMeasure.SEGMENTS
        assert configuration.is_segment_based
        assert not configuration.is_span_based
        assert configuration.project_sample_rates == {}
        assert configuration.sample_rate == 0.5
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)

    def test_subscription_backed_org_without_sample_rate_is_disabled(self) -> None:
        org = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=None,
        ):
            configuration = DynamicSamplingOrgConfiguration(org)

        assert not configuration.is_enabled
        assert configuration.generation == DynamicSamplingGeneration.AM2
        assert configuration.measure == SamplingMeasure.SEGMENTS
        assert configuration.is_segment_based
        assert configuration.sample_rate is None

    def test_am2_ignores_project_mode_option(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=0.5,
        ):
            configuration = DynamicSamplingOrgConfiguration(org)

        assert configuration.is_am2
        assert configuration.is_organization_mode
        assert not configuration.is_project_mode

    def test_org_mode_custom_dynamic_sampling_uses_org_target_sample_rate(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:target_sample_rate", 0.3)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate"
            ) as get_blended_sample_rate,
        ):
            configuration = DynamicSamplingOrgConfiguration(org)

        assert configuration.is_enabled
        assert configuration.generation == DynamicSamplingGeneration.AM3
        assert configuration.is_am3
        assert not configuration.is_am2
        assert configuration.is_organization_mode
        assert not configuration.is_project_mode
        assert configuration.is_am3_organization_mode
        assert not configuration.is_am3_project_mode
        assert configuration.measure == SamplingMeasure.SPANS
        assert configuration.is_span_based
        assert not configuration.is_segment_based
        assert configuration.project_sample_rates == {}
        assert configuration.sample_rate == 0.3
        get_blended_sample_rate.assert_not_called()

    def test_project_mode_custom_dynamic_sampling_stores_project_sample_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project_without_rate = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate"
            ) as get_blended_sample_rate,
        ):
            configuration = DynamicSamplingOrgConfiguration(org)

        assert configuration.is_enabled
        assert configuration.generation == DynamicSamplingGeneration.AM3
        assert configuration.is_am3
        assert configuration.is_project_mode
        assert not configuration.is_organization_mode
        assert configuration.is_am3_project_mode
        assert not configuration.is_am3_organization_mode
        assert configuration.measure == SamplingMeasure.SPANS
        assert configuration.is_span_based
        assert configuration.sample_rate == 0.2
        assert configuration.project_sample_rates == {
            project.id: 0.2,
            project_without_rate.id: None,
        }
        get_blended_sample_rate.assert_not_called()

    def test_project_mode_custom_dynamic_sampling_without_project_rates_is_disabled(
        self,
    ) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = DynamicSamplingOrgConfiguration(org)

        assert not configuration.is_enabled
        assert configuration.generation == DynamicSamplingGeneration.AM3
        assert configuration.is_project_mode
        assert configuration.is_am3_project_mode
        assert configuration.measure == SamplingMeasure.SPANS
        assert configuration.sample_rate is None
        assert configuration.project_sample_rates == {project.id: None}

    def test_project_mode_custom_dynamic_sampling_without_projects_is_disabled(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.feature("organizations:dynamic-sampling-custom"):
            configuration = DynamicSamplingOrgConfiguration(org)

        assert not configuration.is_enabled
        assert configuration.generation == DynamicSamplingGeneration.AM3
        assert configuration.is_project_mode
        assert configuration.is_am3_project_mode
        assert configuration.measure == SamplingMeasure.SPANS
        assert configuration.project_sample_rates == {}
        assert configuration.sample_rate is None

    @override_options({"dynamic-sampling.check_span_feature_flag": True})
    def test_span_measure_org_uses_spans_measure(self) -> None:
        org = self.create_organization()

        with (
            self.options({"dynamic-sampling.measure.spans": [org.id]}),
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ),
        ):
            configuration = DynamicSamplingOrgConfiguration(org)

        assert configuration.is_enabled
        assert configuration.generation == DynamicSamplingGeneration.AM3
        assert configuration.is_am3
        assert configuration.is_organization_mode
        assert configuration.is_am3_organization_mode
        assert configuration.measure == SamplingMeasure.SPANS
        assert configuration.is_span_based
        assert configuration.sample_rate == 1.0
