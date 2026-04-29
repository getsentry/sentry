from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum

from sentry import options, quotas
from sentry.constants import SAMPLING_MODE_DEFAULT, TARGET_SAMPLE_RATE_DEFAULT, ObjectStatus
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.dynamic_sampling.utils import has_custom_dynamic_sampling
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project


class DynamicSamplingGeneration(StrEnum):
    AM2 = "am2"
    AM3 = "am3"


class DynamicSamplingOrgConfiguration:
    def __init__(self, organization: Organization) -> None:
        self.organization = organization
        self._has_custom_ds = has_custom_dynamic_sampling(organization)
        self.measure = self._get_sampling_measure()
        self.generation = self._get_generation()
        self.sampling_mode = self._get_sampling_mode()
        self.sample_rate, self.project_sample_rates = self._get_sample_rates()

    @property
    def is_enabled(self) -> bool:
        return self.sample_rate is not None

    @property
    def is_am2(self) -> bool:
        return self.generation == DynamicSamplingGeneration.AM2

    @property
    def is_am3(self) -> bool:
        return self.generation == DynamicSamplingGeneration.AM3

    @property
    def is_project_mode(self) -> bool:
        return self.sampling_mode == DynamicSamplingMode.PROJECT

    @property
    def is_organization_mode(self) -> bool:
        return self.sampling_mode == DynamicSamplingMode.ORGANIZATION

    @property
    def is_am3_project_mode(self) -> bool:
        return self.is_am3 and self.is_project_mode

    @property
    def is_am3_organization_mode(self) -> bool:
        return self.is_am3 and self.is_organization_mode

    @property
    def is_span_based(self) -> bool:
        return self.measure == SamplingMeasure.SPANS

    @property
    def is_segment_based(self) -> bool:
        return self.measure == SamplingMeasure.SEGMENTS

    def _get_generation(self) -> DynamicSamplingGeneration:
        if self._has_custom_ds or self.measure == SamplingMeasure.SPANS:
            return DynamicSamplingGeneration.AM3
        return DynamicSamplingGeneration.AM2

    def _get_sampling_mode(self) -> DynamicSamplingMode:
        if not self._has_custom_ds:
            return DynamicSamplingMode.ORGANIZATION
        return self.organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)

    def _get_sampling_measure(self) -> SamplingMeasure:
        if self._has_custom_ds:
            return SamplingMeasure.SPANS
        if options.get("dynamic-sampling.check_span_feature_flag") and self.organization.id in (
            options.get("dynamic-sampling.measure.spans") or []
        ):
            return SamplingMeasure.SPANS
        return SamplingMeasure.SEGMENTS

    def _get_sample_rates(self) -> tuple[float | None, Mapping[int, float | None]]:
        if self.is_am2:
            return quotas.backend.get_blended_sample_rate(organization_id=self.organization.id), {}

        if self.is_am3_project_mode:
            return self._get_project_mode_sample_rates()

        if self.is_am3_organization_mode:
            return (
                float(
                    self.organization.get_option(
                        "sentry:target_sample_rate", TARGET_SAMPLE_RATE_DEFAULT
                    )
                ),
                {},
            )

        return quotas.backend.get_blended_sample_rate(organization_id=self.organization.id), {}

    def _get_project_mode_sample_rates(self) -> tuple[float | None, Mapping[int, float | None]]:
        project_ids = list(
            Project.objects.filter(
                organization_id=self.organization.id, status=ObjectStatus.ACTIVE
            ).values_list("id", flat=True)
        )
        if not project_ids:
            return None, {}

        project_sample_rates = ProjectOption.objects.get_value_bulk_id(
            project_ids, "sentry:target_sample_rate"
        )
        sample_rates = {
            project_id: (
                float(project_sample_rates[project_id])
                if project_sample_rates[project_id] is not None
                else None
            )
            for project_id in project_ids
        }
        for sample_rate in sample_rates.values():
            if sample_rate is not None:
                return sample_rate, sample_rates

        return None, sample_rates
