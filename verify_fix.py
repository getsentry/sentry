#!/usr/bin/env python3
"""
Verification script for the UniqueConditionQuery hashability fix
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class UniqueConditionQuery:
    """
    Represents all the data that uniquely identifies a condition and its
    single respective Snuba query that must be made. Multiple instances of the
    same condition can share a single query.
    """

    handler: type
    interval: str
    environment_id: int | None
    comparison_interval: str | None = None
    filters: tuple[frozenset[tuple[str, Any]], ...] | None = None

    def __post_init__(self):
        if self.filters is None:
            return
        # Convert list/iterable of dicts to tuple of frozensets of items
        if not isinstance(self.filters, tuple):
            converted_filters = tuple(
                frozenset(filter_dict.items()) if isinstance(filter_dict, dict) else frozenset()
                for filter_dict in self.filters
            )
            object.__setattr__(self, "filters", converted_filters)

    def __repr__(self):
        return f"UniqueConditionQuery(handler={self.handler.__name__}, interval={self.interval}, environment_id={self.environment_id}, comparison_interval={self.comparison_interval}, filters={self.filters})"


class MockHandler:
    pass


def test_reproduce_issue():
    """Test that reproduces the original issue"""
    print("Testing the original issue scenario...")
    
    # Create a UniqueConditionQuery with list filters (the original issue)
    filters = [{"key1": "value1"}, {"key2": "value2"}]
    query = UniqueConditionQuery(
        handler=MockHandler,
        interval="1m",
        environment_id=None,
        filters=filters
    )
    
    print(f"Created query: {query}")
    print(f"Filters type: {type(query.filters)}")
    print(f"Filters value: {query.filters}")
    
    # This should work now (the original issue would fail here)
    try:
        hash_value = hash(query)
        print(f"✓ Successfully hashed query: {hash_value}")
    except TypeError as e:
        print(f"❌ Failed to hash query: {e}")
        return False
    
    # Test using as dictionary key (this is where the original error occurred)
    try:
        condition_groups = {}
        condition_groups[query] = {123, 456}  # simulating the original code
        print(f"✓ Successfully used as dictionary key")
        print(f"✓ Dictionary access works: {condition_groups[query]}")
    except TypeError as e:
        print(f"❌ Failed to use as dictionary key: {e}")
        return False
    
    return True


def test_edge_cases():
    """Test edge cases"""
    print("\nTesting edge cases...")
    
    # Test with None filters
    query1 = UniqueConditionQuery(
        handler=MockHandler,
        interval="1m",
        environment_id=None,
        filters=None
    )
    
    try:
        hash(query1)
        print("✓ Works with None filters")
    except Exception as e:
        print(f"❌ Failed with None filters: {e}")
        return False
    
    # Test with empty list
    query2 = UniqueConditionQuery(
        handler=MockHandler,
        interval="1m",
        environment_id=None,
        filters=[]
    )
    
    try:
        hash(query2)
        print("✓ Works with empty list filters")
    except Exception as e:
        print(f"❌ Failed with empty list filters: {e}")
        return False
    
    # Test equality - same filters should produce same hash
    filters_a = [{"key": "value"}]
    filters_b = [{"key": "value"}]
    
    query_a = UniqueConditionQuery(
        handler=MockHandler,
        interval="1m",
        environment_id=None,
        filters=filters_a
    )
    
    query_b = UniqueConditionQuery(
        handler=MockHandler,
        interval="1m",
        environment_id=None,
        filters=filters_b
    )
    
    if hash(query_a) == hash(query_b) and query_a == query_b:
        print("✓ Equal queries have equal hashes")
    else:
        print("❌ Equal queries don't have equal hashes")
        return False
    
    return True


if __name__ == "__main__":
    print("=" * 60)
    print("Verifying fix for UniqueConditionQuery hashability issue")
    print("=" * 60)
    
    success = True
    success &= test_reproduce_issue()
    success &= test_edge_cases()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ All tests passed! The fix is working correctly.")
        print("✅ UniqueConditionQuery can now be used as a dictionary key even with list filters.")
    else:
        print("❌ Some tests failed!")
    print("=" * 60)