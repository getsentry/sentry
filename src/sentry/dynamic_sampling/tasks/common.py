from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import timedelta
from typing import TypedDict

import sentry_sdk

from sentry import quotas
from sentry.dynamic_sampling.tasks.helpers.sliding_window import extrapolate_monthly_volume
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mri import SpanMRI

ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL = timedelta(minutes=5)


class MeasureConfig(TypedDict):
    """Configuration for a sampling measure query."""

    mri: str
    use_case_id: UseCaseID
    tags: dict[str, str]


# Configuration for each sampling measure type
MEASURE_CONFIGS: dict[SamplingMeasure, MeasureConfig] = {
    # SEGMENTS: SpanMRI with is_segment=true filter (replacement for transactions)
    SamplingMeasure.SEGMENTS: {
        "mri": SpanMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.SPANS,
        "tags": {"is_segment": "true"},
    },
    # SPANS: SpanMRI without is_segment filter (AM3/project mode - counts all spans)
    SamplingMeasure.SPANS: {
        "mri": SpanMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.SPANS,
        "tags": {},
    },
}


@dataclass(frozen=True)
class OrganizationDataVolume:
    """
    Represents the total and indexed number of transactions received by an organization
    (in a particular interval of time).
    """

    # organization id
    org_id: int
    # total number of transactions
    total: int
    # number of transactions indexed (i.e. stored)
    indexed: int | None

    def is_valid_for_recalibration(self) -> bool:
        return self.total > 0 and self.indexed is not None and self.indexed > 0


def get_effective_sample_rate(volume: OrganizationDataVolume | None) -> float | None:
    if volume is None or volume.indexed is None or volume.total <= 0:
        return None
    return volume.indexed / volume.total


def sample_rate_to_float(sample_rate: str | None) -> float | None:
    """
    Converts a sample rate to a float or returns None in case the conversion failed.
    """
    if sample_rate is None:
        return None

    try:
        return float(sample_rate)
    except (TypeError, ValueError):
        return None


def are_equal_with_epsilon(a: float | None, b: float | None) -> bool:
    """
    Checks if two floating point numbers are equal within an error boundary.
    """
    if a is None and b is None:
        return True

    if a is None or b is None:
        return False

    return math.isclose(a, b)


def compute_guarded_sliding_window_sample_rate(
    org_id: int,
    project_id: int | None,
    total_root_count: int,
    window_size: int,
) -> float | None:
    """
    Computes the actual sliding window sample rate by guarding any exceptions and returning None in case
    any problem would arise.
    """
    try:
        # We want to compute the sliding window sample rate by considering a window of time.
        # This piece of code is very delicate, thus we want to guard it properly and capture any errors.
        return compute_sliding_window_sample_rate(org_id, project_id, total_root_count, window_size)
    except Exception as e:
        sentry_sdk.capture_exception(
            e,
            extras={
                "org_id": org_id,
                "project_id": project_id,
                "total_root_count": total_root_count,
                "window_size": window_size,
            },
        )
        return None


def compute_sliding_window_sample_rate(
    org_id: int,
    project_id: int | None,
    total_root_count: int,
    window_size: int,
) -> float | None:
    """
    Computes the actual sample rate for the sliding window given the total root count and the size of the
    window that was used for computing the root count.

    The org_id is used only because it is required on the quotas side to determine whether dynamic sampling is
    enabled in the first place for that project.
    """
    extrapolated_volume = extrapolate_monthly_volume(volume=total_root_count, hours=window_size)
    if extrapolated_volume is None:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("org_id", org_id)
            scope.set_extra("window_size", window_size)
            sentry_sdk.capture_message("The volume of the current month can't be extrapolated.")

        return None

    sampling_tier = quotas.backend.get_transaction_sampling_tier_for_volume(
        org_id, extrapolated_volume
    )
    if sampling_tier is None:
        return None

    _, sample_rate = sampling_tier
    return float(sample_rate)
