from django.test import override_settings

from sentry.ingest.slicing import (
    is_sliced,
    map_logical_partition_to_slice,
    map_org_id_to_logical_partition,
)


def test_is_storage_partitioned():
    with override_settings(SENTRY_SLICING_CONFIG={"generic_metrics": {(0, 256): 0}}):
        assert is_sliced("generic_metrics")
        assert not is_sliced("errors")


def test_map_logical_partition_to_slice():
    with override_settings(SENTRY_SLICING_CONFIG={"generic_metrics": {(0, 128): 0, (128, 256): 1}}):
        assert map_logical_partition_to_slice("generic_metrics", 0) == 0
        assert map_logical_partition_to_slice("generic_metrics", 127) == 0
        assert map_logical_partition_to_slice("generic_metrics", 128) == 1
        assert map_logical_partition_to_slice("generic_metrics", 255) == 1


def test_map_org_id_to_logical_partition():
    base_org_id = 256 * 20

    assert map_org_id_to_logical_partition(base_org_id + 1) == 1
    assert map_org_id_to_logical_partition(base_org_id + 127) == 127
    assert map_org_id_to_logical_partition(base_org_id + 256) == 0
