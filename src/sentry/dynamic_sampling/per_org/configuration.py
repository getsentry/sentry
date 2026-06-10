from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import timedelta

from django.core.exceptions import ObjectDoesNotExist

from sentry import options, quotas
from sentry.constants import SAMPLING_MODE_DEFAULT, TARGET_SAMPLE_RATE_DEFAULT, ObjectStatus
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.calculations import calculate_recalibration_factor
from sentry.dynamic_sampling.per_org.queries import (
    get_eap_organization_volume,
    get_outcomes_organization_volume,
)
from sentry.dynamic_sampling.per_org.telemetry import (
    DynamicSamplingException,
    DynamicSamplingStatus,
)
from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.tasks.common import compute_sliding_window_sample_rate
from sentry.dynamic_sampling.tasks.constants import MAX_REBALANCE_FACTOR, MIN_REBALANCE_FACTOR
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import FALLBACK_SLIDING_WINDOW_SIZE
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.dynamic_sampling.utils import has_custom_dynamic_sampling
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project

TargetSampleRate = float | None
ProjectSampleRates = dict[ProjectId, TargetSampleRate]
RecalibrationFactor = float | None
logger = logging.getLogger(__name__)


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
    sample_rate: TargetSampleRate = None
    should_balance_projects: bool = True
    organization_recalibration_factor: RecalibrationFactor = None
    projects: list[Project]

    def __init__(self, organization: Organization) -> None:
        self.organization = organization
        self.sliding_window_sample_rate: TargetSampleRate = None
        self.project_sample_rates: ProjectSampleRates = {}

    @property
    @abstractmethod
    def is_enabled(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_sample_rate(self) -> TargetSampleRate:
        raise NotImplementedError

    def get_project_sample_rates(self) -> ProjectSampleRates:
        return self.project_sample_rates

    def set_rebalanced_project_sample_rates(
        self, rebalanced_projects: list[RebalancedItem]
    ) -> None:
        self.project_sample_rates = {
            int(item.id): item.new_sample_rate for item in rebalanced_projects
        }

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

    def _get_organization_recalibration_factor(self) -> RecalibrationFactor:
        if not self.projects:
            return None

        org_volume = get_outcomes_organization_volume(
            self.organization.id, time_interval=timedelta(minutes=5)
        )
        if org_volume is None or not org_volume.is_valid_for_recalibration():
            return None

        old_pipeline_factor = legacy_recalibration_cache.get_adjusted_factor(self.organization.id)
        new_pipeline_factor = per_org_recalibration_cache.get_adjusted_factor(self.organization.id)
        logger.info(
            "dynamic_sampling.per_org.recalibration_factor_discrepancy",
            extra={
                "org_id": self.organization.id,
                "discrepancy": new_pipeline_factor - old_pipeline_factor,
                "old_pipeline_factor": old_pipeline_factor,
                "new_pipeline_factor": new_pipeline_factor,
                "sample_rate": self.get_sample_rate(),
            },
        )
        adjusted_factor = calculate_recalibration_factor(
            org_volume,
            new_pipeline_factor,
            self.get_sample_rate(),
        )
        if adjusted_factor is None:
            return None
        if adjusted_factor < MIN_REBALANCE_FACTOR or adjusted_factor > MAX_REBALANCE_FACTOR:
            per_org_recalibration_cache.delete_adjusted_factor(self.organization.id)
            return None

        per_org_recalibration_cache.set_guarded_adjusted_factor(
            self.organization.id, adjusted_factor
        )
        return adjusted_factor


class NoDynamicSamplingConfiguration(BaseDynamicSamplingConfiguration):
    def __init__(self) -> None:
        self.sliding_window_sample_rate: TargetSampleRate = None
        self.project_sample_rates: ProjectSampleRates = {}

    @property
    def is_enabled(self) -> bool:
        return False

    def get_sample_rate(self) -> TargetSampleRate:
        return None


class AutomaticDynamicSamplingConfiguration(BaseDynamicSamplingConfiguration):
    """
    This configuration is used for organizations for which sample rates are computed based on the volume sent.
    It currently applies to AM2 organizations.
    It consists of the following components:
    - The sample rate is either based on the reserved volume or the ingested volume, which are then used as input to the quotas API to get the sample rate.
    - Projects are rebalanced
    """

    sample_rate: TargetSampleRate
    organization_recalibration_factor: RecalibrationFactor

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.measure = self._get_sampling_measure()
        try:
            self.sample_rate = quotas.backend.get_blended_sample_rate(
                organization_id=organization.id
            )
        except ObjectDoesNotExist as exc:
            raise DynamicSamplingException(DynamicSamplingStatus.NO_SUBSCRIPTION) from exc
        if not self.is_enabled:
            return
        self.projects = self._get_projects()
        self.sliding_window_sample_rate = self._get_sliding_window_sample_rate()
        self.organization_recalibration_factor = self._get_organization_recalibration_factor()

    @property
    def is_enabled(self) -> bool:
        return self.sample_rate is not None

    def get_sample_rate(self) -> TargetSampleRate:
        if self.sliding_window_sample_rate is not None:
            return self.sliding_window_sample_rate
        return self.sample_rate

    def _get_sliding_window_sample_rate(self) -> TargetSampleRate:
        """
        The sliding window sample rate uses the ingested segment volume to compute the sample rate by extrapolating
        the volume of the current month and then using the quotas API to get the sample rate for that volume.
        """
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
    """
    This configuration is used for organizations for which sample rates are computed based on the target sample rate option.
    It currently applies to AM3 organizations with custom dynamic sampling enabled and sampling mode set to organization.
    It consists of the following components:
    - The sample rate is based on the target sample rate option that can be set by the user at the organzation level. There is no volume-based sample rate computation.
    - Projects are rebalanced
    """

    sample_rate: TargetSampleRate
    organization_recalibration_factor: RecalibrationFactor

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.measure = self._get_sampling_measure()
        self.projects = self._get_projects()

        self.sample_rate = float(
            self.organization.get_option("sentry:target_sample_rate", TARGET_SAMPLE_RATE_DEFAULT)
        )
        self.project_sample_rates = {}
        self.organization_recalibration_factor = self._get_organization_recalibration_factor()

    @property
    def is_enabled(self) -> bool:
        return True

    def get_sample_rate(self) -> TargetSampleRate:
        return self.sample_rate


class CustomDynamicSamplingProjectConfiguration(BaseDynamicSamplingConfiguration):
    """
    This configuration is used for organizations for which sample rates are computed based on the target sample rate option.
    It currently applies to AM3 organizations with custom dynamic sampling enabled and sampling mode set to project.
    It consists of the following components:
    - The sample rate is based on the target sample rate option that can be set by the user at the project level. There is no volume-based sample rate computation.
    - Projects are not rebalanced
    """

    should_balance_projects: bool = False

    def __init__(self, organization: Organization) -> None:
        super().__init__(organization)
        self.projects = self._get_projects()
        self.project_sample_rates = self._get_project_target_sample_rates()
        self.measure = self._get_sampling_measure()

    @property
    def is_enabled(self) -> bool:
        return any(sample_rate is not None for sample_rate in self.project_sample_rates.values())

    def get_sample_rate(self) -> TargetSampleRate:
        return None

    def _get_project_target_sample_rates(self) -> ProjectSampleRates:
        project_sample_rates = ProjectOption.objects.get_value_bulk(
            self.projects, "sentry:target_sample_rate"
        )

        return {
            project.id: float(sample_rate) if sample_rate is not None else None
            for project, sample_rate in project_sample_rates.items()
        }
