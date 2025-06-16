#!/usr/bin/env python3
"""
Test script to verify that UniqueConditionQuery is hashable with filter lists
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


# Simple mock class since we can't import the real one
class MockEventFrequencyQueryHandler:
    pass


try:
    from sentry.workflow_engine.processors.delayed_workflow import UniqueConditionQuery

    print("✓ Successfully imported UniqueConditionQuery from delayed_workflow module")
except ImportError as e:
    print(f"❌ Failed to import: {e}")
    sys.exit(1)


def test_hashable_with_filters():
    # Test with list of dicts (should convert to hashable format)
    filters = [{"key1": "value1"}, {"key2": "value2"}]
    query = UniqueConditionQuery(
        handler=MockEventFrequencyQueryHandler, interval="1m", environment_id=None, filters=filters
    )

    # This should not raise an error if hashable
    try:
        hash(query)
        print("✓ UniqueConditionQuery with list filters is hashable")
    except TypeError as e:
        print(f"✗ UniqueConditionQuery with list filters failed to hash: {e}")
        return False

    # Test using as dictionary key
    try:
        test_dict = {query: "test_value"}
        print("✓ UniqueConditionQuery can be used as dictionary key")
    except TypeError as e:
        print(f"✗ UniqueConditionQuery failed as dictionary key: {e}")
        return False

    return True


def test_hashable_without_filters():
    # Test without filters
    query = UniqueConditionQuery(
        handler=MockEventFrequencyQueryHandler, interval="1m", environment_id=None, filters=None
    )

    try:
        hash(query)
        print("✓ UniqueConditionQuery without filters is hashable")
    except TypeError as e:
        print(f"✗ UniqueConditionQuery without filters failed to hash: {e}")
        return False

    return True


def test_filters_conversion():
    # Test that filters are properly converted
    filters = [{"key1": "value1"}, {"key2": "value2"}]
    query = UniqueConditionQuery(
        handler=MockEventFrequencyQueryHandler, interval="1m", environment_id=None, filters=filters
    )

    # Check that filters are converted to the expected format
    expected_format = tuple([frozenset([("key1", "value1")]), frozenset([("key2", "value2")])])
    if query.filters == expected_format:
        print("✓ Filters converted to expected hashable format")
        return True
    else:
        print(
            f"✗ Filters not converted properly. Expected: {expected_format}, Got: {query.filters}"
        )
        return False


if __name__ == "__main__":
    print("Testing UniqueConditionQuery hashability...")

    all_passed = True
    all_passed &= test_hashable_with_filters()
    all_passed &= test_hashable_without_filters()
    all_passed &= test_filters_conversion()

    if all_passed:
        print("\n✓ All tests passed!")
        sys.exit(0)
    else:
        print("\n✗ Some tests failed!")
        sys.exit(1)
