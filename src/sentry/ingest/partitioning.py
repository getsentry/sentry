"""
The number of logical partitions used to distinguish between where records
should be stored. These do not require individual physical slices but allow
for repartitioning with less code changes per physical change.
"""
from django.conf import settings


def map_org_id_to_logical_partition(org_id: int) -> int:
    """
    Maps an org_id to a logical partition. Since SENTRY_SLICING_LOGICAL_PARTITION_COUNT is
    fixed, an org id will always be mapped to the same logical partition.
    """
    return org_id % settings.SENTRY_SLICING_LOGICAL_PARTITION_COUNT


def map_logical_partition_to_slice(dataset_name: str, logical_partition: int) -> int:
    """
    Maps a logical partition to a slice.
    """

    assert is_storage_partitioned(
        dataset_name
    ), f"cannot retrieve slice of non-partitioned storage {dataset_name}"
    assert (
        dataset_name in settings.SENTRY_SLICING_CONFIG
    ), f"logical partition mapping missing for {dataset_name}"

    for ((logical_part_lo_incl, logical_part_hi_excl), slice_id) in settings.SENTRY_SLICING_CONFIG[
        dataset_name
    ].items():
        if logical_partition >= logical_part_lo_incl and logical_partition < logical_part_hi_excl:
            return slice_id

    assert False, f"no mapping for dataset {dataset_name} for logical_partition {logical_partition}"


def is_storage_partitioned(dataset_name: str) -> bool:
    """
    Returns whether the storage set is partitioned.
    """

    return dataset_name in settings.SENTRY_SLICING_CONFIG.keys()
