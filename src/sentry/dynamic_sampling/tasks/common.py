from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import timedelta

import sentry_sdk

from sentry import quotas
from sentry.dynamic_sampling.tasks.helpers.sliding_window import extrapolate_monthly_volume

ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL = timedelta(minutes=5)


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
