"""
The number of logical partitions used to distinguish between where records
should be stored. These do not require individual physical slices but allow
for repartitioning with less code changes per physical change.
"""
from typing import Literal

from django.conf import settings

Sliceable = Literal["generic_metrics_sets", "generic_metrics_distributions"]


def map_org_id_to_logical_partition(org_id: int) -> int:
    """
    Maps an org_id to a logical partition. Since SENTRY_SLICING_LOGICAL_PARTITION_COUNT is
    fixed, an org id will always be mapped to the same logical partition.
    """
    return org_id % settings.SENTRY_SLICING_LOGICAL_PARTITION_COUNT


def map_logical_partition_to_slice(sliceable: Sliceable, logical_partition: int) -> int:
    """
    Maps a logical partition to a slice.
    """

    assert is_sliced(sliceable), f"cannot retrieve slice of non-partitioned sliceable {sliceable}"

    for ((logical_part_lo_incl, logical_part_hi_excl), slice_id) in settings.SENTRY_SLICING_CONFIG[
        sliceable
    ].items():
        if logical_partition >= logical_part_lo_incl and logical_partition < logical_part_hi_excl:
            return slice_id

    assert False, f"no mapping for sliceable {sliceable} for logical_partition {logical_partition}"


def is_sliced(sliceable: Sliceable) -> bool:
    """
    Returns whether the sliceable is sliced (environment-specific).
    """

    return sliceable in settings.SENTRY_SLICING_CONFIG.keys()
