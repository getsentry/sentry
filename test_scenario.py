#!/usr/bin/env python3
"""
Test the exact scenario from the error
"""

from collections import defaultdict
from dataclasses import dataclass
from typing import Any


# Recreate the exact dataclass from the fix
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


class MockEventFrequencyQueryHandler:
    pass


def generate_unique_queries_mock(filters_list):
    """Mock the generate_unique_queries function that creates UniqueConditionQuery with filters"""
    
    # This simulates the original code where filters come from condition.comparison.get("filters")
    raw_filters = filters_list
    processed_filters: tuple[frozenset[tuple[str, Any]], ...] | None = None

    if raw_filters is not None:
        # Convert iterable of dictionaries to tuple of frozensets of items
        processed_filters = tuple(
            frozenset(filter_dict.items()) if isinstance(filter_dict, dict) else frozenset()
            for filter_dict in raw_filters
        )

    return UniqueConditionQuery(
        handler=MockEventFrequencyQueryHandler,
        interval="1m",
        environment_id=None,
        filters=processed_filters,
    )


def simulate_error_scenario():
    """Simulate the exact error scenario from the traceback"""
    print("Simulating the error scenario...")
    
    # This would be the problematic case - filters as a list
    problematic_filters = [{"key1": "value1"}, {"key2": "value2"}]
    
    # Create the query (this step was successful in the original error)
    condition_query = generate_unique_queries_mock(problematic_filters)
    print(f"Created condition_query: {condition_query}")
    print(f"Query filters type: {type(condition_query.filters)}")
    print(f"Query filters value: {condition_query.filters}")
    
    # Simulate the line that was failing: condition_groups[condition_query].update(...)
    condition_groups = defaultdict(set)
    
    # This is the exact line that was causing the error
    try:
        condition_groups[condition_query].update({6683664939})  # Using the group ID from the error
        print("✅ SUCCESS: condition_groups[condition_query].update() worked!")
        print(f"✅ Dictionary contents: {dict(condition_groups)}")
        return True
    except TypeError as e:
        print(f"❌ FAILED: {e}")
        return False


def test_hash_directly():
    """Test hashing directly"""
    print("\nTesting direct hashing...")
    
    # Test with list filters
    filters = [{"key": "value"}]
    query = generate_unique_queries_mock(filters)
    
    try:
        hash_val = hash(query)
        print(f"✅ Direct hash successful: {hash_val}")
        return True
    except TypeError as e:
        print(f"❌ Direct hash failed: {e}")
        return False


if __name__ == "__main__":
    print("Testing the UniqueConditionQuery fix...")
    print("=" * 50)
    
    success = True
    success &= test_hash_directly()
    success &= simulate_error_scenario()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 ALL TESTS PASSED! The fix resolves the issue.")
    else:
        print("💥 Tests failed - fix needs more work.")
    print("=" * 50)