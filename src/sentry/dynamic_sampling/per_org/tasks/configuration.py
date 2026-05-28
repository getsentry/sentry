from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from datetime import timedelta

from django.core.exceptions import ObjectDoesNotExist

from sentry import options, quotas
from sentry.constants import SAMPLING_MODE_DEFAULT, TARGET_SAMPLE_RATE_DEFAULT, ObjectStatus
from sentry.dynamic_sampling.per_org.tasks.queries import get_eap_organization_volume
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    DynamicSamplingException,
    DynamicSamplingStatus,
)
from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.tasks.common import compute_sliding_window_sample_rate
from sentry.dynamic_sampling.tasks.helpers.sliding_window import FALLBACK_SLIDING_WINDOW_SIZE
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
    should_balance_projects: bool = True
    projects: list[Project]

    def __init__(self, organization: Organization) -> None:
        self.organization = organization
        self.sliding_window_sample_rate: TargetSampleRate = None

    @property
    @abstractmethod
    def is_enabled(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_sample_rate(self) -> TargetSampleRate:
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

    def _get_projects(self) -> list[Project]:
        return list(
            Project.objects.filter(organization_id=self.organization.id, status=ObjectStatus.ACTIVE)
        )


class NoDynamicSamplingConfiguration(BaseDynamicSamplingConfiguration):
    def __init__(self) -> None:
        self.sliding_window_sample_rate: TargetSampleRate = None

    @property
    def is_enabled(self) -> bool:
        return False

    def get_sample_rate(self) -> TargetSampleRate:
        return None


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
            raise DynamicSamplingException(DynamicSamplingStatus.NO_SUBSCRIPTION) from exc
        self.projects = self._get_projects()
        self.sliding_window_sample_rate = self._get_sliding_window_sample_rate()

    @property
    def is_enabled(self) -> bool:
        return self.sample_rate is not None

    def get_sample_rate(self) -> TargetSampleRate:
        if self.sliding_window_sample_rate is not None:
            return self.sliding_window_sample_rate
        return self.sample_rate

    def _get_sliding_window_sample_rate(self) -> TargetSampleRate:
        if not self.projects:
            return None

        org_volume_24h = get_eap_organization_volume(
            self, time_interval=timedelta(hours=FALLBACK_SLIDING_WINDOW_SIZE)
        )
        if org_volume_24h is None:
            return None

        return compute_sliding_window_sample_rate(
            org_id=self.organization.id,
            project_id=None,
            total_root_count=org_volume_24h.total,
            window_size=FALLBACK_SLIDING_WINDOW_SIZE,
        )


class CustomDynamicSamplingOrganizationConfiguration(BaseDynamicSamplingConfiguration):
    sample_rate: TargetSampleRate

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.measure = self._get_sampling_measure()
        self.projects = self._get_projects()

        self.sample_rate = float(
            self.organization.get_option("sentry:target_sample_rate", TARGET_SAMPLE_RATE_DEFAULT)
        )

    @property
    def is_enabled(self) -> bool:
        return True

    def get_sample_rate(self) -> TargetSampleRate:
        return self.sample_rate


class CustomDynamicSamplingProjectConfiguration(BaseDynamicSamplingConfiguration):
    project_target_sample_rates: ProjectTargetSampleRates
    should_balance_projects: bool = False

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.projects = self._get_projects()
        self.project_target_sample_rates = self._get_project_target_sample_rates()
        self.measure = self._get_sampling_measure()

    @property
    def is_enabled(self) -> bool:
        return any(
            sample_rate is not None for sample_rate in self.project_target_sample_rates.values()
        )

    def get_sample_rate(self) -> TargetSampleRate:
        return None

    def _get_project_target_sample_rates(self) -> ProjectTargetSampleRates:
        project_sample_rates = ProjectOption.objects.get_value_bulk(
            self.projects, "sentry:target_sample_rate"
        )

        sample_rates: ProjectTargetSampleRates = {
            project.id: float(sample_rate) if sample_rate is not None else None
            for project, sample_rate in project_sample_rates.items()
        }
        return sample_rates
