from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping

from django.core.exceptions import ObjectDoesNotExist

from sentry import options, quotas
from sentry.constants import SAMPLING_MODE_DEFAULT, TARGET_SAMPLE_RATE_DEFAULT, ObjectStatus
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    DynamicSamplingException,
    TelemetryStatus,
)
from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.dynamic_sampling.utils import has_custom_dynamic_sampling
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project

TargetSampleRate = float | None
ProjectTargetSampleRates = Mapping[ProjectId, TargetSampleRate]


def get_configuration(organization_id: int) -> BaseDynamicSamplingConfiguration:
    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        return NoDynamicSamplingConfiguration()

    if not has_custom_dynamic_sampling(organization):
        configuration = AutomaticDynamicSamplingConfiguration(organization)
        if not configuration.is_enabled:
            return NoDynamicSamplingConfiguration()
        return configuration

    if (
        organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)
        == DynamicSamplingMode.PROJECT
    ):
        return CustomDynamicSamplingProjectConfiguration(organization)

    return CustomDynamicSamplingOrganizationConfiguration(organization)


class BaseDynamicSamplingConfiguration(ABC):
    measure: SamplingMeasure

    def __init__(self, organization: Organization) -> None:
        self.organization = organization

    @property
    @abstractmethod
    def is_enabled(self) -> bool:
        raise NotImplementedError

    @property
    def is_span_based(self) -> bool:
        return self.measure == SamplingMeasure.SPANS

    @property
    def is_segment_based(self) -> bool:
        return self.measure == SamplingMeasure.SEGMENTS

    def _get_sampling_measure(self) -> SamplingMeasure:
        if options.get("dynamic-sampling.check_span_feature_flag") and self.organization.id in (
            options.get("dynamic-sampling.measure.spans") or []
        ):
            return SamplingMeasure.SPANS
        return SamplingMeasure.SEGMENTS


class NoDynamicSamplingConfiguration(BaseDynamicSamplingConfiguration):
    def __init__(self) -> None:
        pass

    @property
    def is_enabled(self) -> bool:
        return False


class AutomaticDynamicSamplingConfiguration(BaseDynamicSamplingConfiguration):
    sample_rate: TargetSampleRate

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.measure = self._get_sampling_measure()
        try:
            self.sample_rate = quotas.backend.get_blended_sample_rate(
                organization_id=organization.id
            )
        except ObjectDoesNotExist as exc:
            raise DynamicSamplingException(TelemetryStatus.NO_SUBSCRIPTION) from exc

    @property
    def is_enabled(self) -> bool:
        return self.sample_rate is not None


class CustomDynamicSamplingOrganizationConfiguration(BaseDynamicSamplingConfiguration):
    sample_rate: TargetSampleRate

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.measure = self._get_sampling_measure()

        self.sample_rate = float(
            self.organization.get_option("sentry:target_sample_rate", TARGET_SAMPLE_RATE_DEFAULT)
        )

    @property
    def is_enabled(self) -> bool:
        return True


class CustomDynamicSamplingProjectConfiguration(BaseDynamicSamplingConfiguration):
    project_target_sample_rates: ProjectTargetSampleRates

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.project_target_sample_rates = self._get_project_target_sample_rates()
        self.measure = self._get_sampling_measure()

    @property
    def is_enabled(self) -> bool:
        return any(
            sample_rate is not None for sample_rate in self.project_target_sample_rates.values()
        )

    def _get_project_target_sample_rates(self) -> ProjectTargetSampleRates:
        project_ids = list(
            Project.objects.filter(
                organization_id=self.organization.id, status=ObjectStatus.ACTIVE
            ).values_list("id", flat=True)
        )
        if not project_ids:
            return {}

        project_sample_rates = ProjectOption.objects.get_value_bulk_id(
            project_ids, "sentry:target_sample_rate"
        )
        sample_rates: ProjectTargetSampleRates = {
            project_id: (
                float(project_sample_rates[project_id])
                if project_sample_rates[project_id] is not None
                else None
            )
            for project_id in project_ids
        }
        return sample_rates
