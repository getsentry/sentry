"""
Tests to verify that the PreprodSize dataset is properly registered.

These are smoke tests to ensure the dataset can be imported and is
available in the dataset registry. Full integration tests with actual
preprod data can be added later.
"""

import pytest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter

from sentry.search.eap.preprod_size.aggregates import PREPROD_SIZE_AGGREGATE_DEFINITIONS
from sentry.search.eap.preprod_size.attributes import PREPROD_SIZE_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.preprod_size.definitions import PREPROD_SIZE_DEFINITIONS
from sentry.snuba import preprod_size, utils


def test_preprod_size_dataset_imported():
    """Verify PreprodSize class can be imported and has required attributes."""
    assert hasattr(preprod_size, "PreprodSize")
    assert hasattr(preprod_size.PreprodSize, "DEFINITIONS")
    assert hasattr(preprod_size.PreprodSize, "run_timeseries_query")


def test_preprod_size_in_dataset_options():
    """Verify PreprodSize is registered in DATASET_OPTIONS."""
    assert "preprodSize" in utils.DATASET_OPTIONS
    assert utils.DATASET_OPTIONS["preprodSize"] == preprod_size.PreprodSize


def test_preprod_size_in_rpc_datasets():
    """Verify PreprodSize is in RPC_DATASETS set."""
    assert preprod_size.PreprodSize in utils.RPC_DATASETS


def test_sub_item_type_filter():
    """Verify the sub_item_type filter is correctly constructed."""
    filter = preprod_size.PreprodSize._get_sub_item_type_filter()
    assert filter.HasField("comparison_filter")
    assert filter.comparison_filter.key.name == "sub_item_type"
    assert filter.comparison_filter.key.type == AttributeKey.Type.TYPE_STRING
    assert filter.comparison_filter.op == ComparisonFilter.OP_EQUALS
    assert filter.comparison_filter.value.val_str == "size_metric"


def test_definitions_has_correct_trace_item_type():
    """Verify PREPROD_SIZE_DEFINITIONS has the correct trace_item_type."""
    assert PREPROD_SIZE_DEFINITIONS.trace_item_type == TraceItemType.TRACE_ITEM_TYPE_PREPROD


def test_attribute_definitions_includes_sub_item_type():
    """Verify sub_item_type attribute is defined."""
    assert "sub_item_type" in PREPROD_SIZE_ATTRIBUTE_DEFINITIONS
    assert PREPROD_SIZE_ATTRIBUTE_DEFINITIONS["sub_item_type"].public_alias == "sub_item_type"
    assert PREPROD_SIZE_ATTRIBUTE_DEFINITIONS["sub_item_type"].internal_name == "sub_item_type"
    assert PREPROD_SIZE_ATTRIBUTE_DEFINITIONS["sub_item_type"].search_type == "string"


def test_attribute_definitions_includes_size_fields():
    """Verify size metric fields are defined."""
    size_fields = [
        "max_install_size",
        "max_download_size",
        "min_install_size",
        "min_download_size",
    ]

    for field in size_fields:
        assert field in PREPROD_SIZE_ATTRIBUTE_DEFINITIONS
        assert PREPROD_SIZE_ATTRIBUTE_DEFINITIONS[field].search_type == "integer"


def test_aggregate_definitions_includes_max():
    """Verify max aggregate is defined for preprod size metrics."""
    assert "max" in PREPROD_SIZE_AGGREGATE_DEFINITIONS
    max_def = PREPROD_SIZE_AGGREGATE_DEFINITIONS["max"]
    assert max_def.default_search_type == "number"
    # Verify max accepts numeric types including size types
    assert len(max_def.arguments) == 1
    arg = max_def.arguments[0]
    assert "number" in arg.attribute_types
    assert "integer" in arg.attribute_types


def test_definitions_has_aggregates():
    """Verify PREPROD_SIZE_DEFINITIONS includes aggregate definitions."""
    assert PREPROD_SIZE_DEFINITIONS.aggregates == PREPROD_SIZE_AGGREGATE_DEFINITIONS
    assert "max" in PREPROD_SIZE_DEFINITIONS.aggregates


if __name__ == "__main__":
    pytest.main([__file__, "-vv"])
