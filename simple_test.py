#!/usr/bin/env python3
"""
Simple test to see if the dataclass works
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


# Mock handler
class MockHandler:
    pass


def test_basic():
    # Test without filters
    query1 = UniqueConditionQuery(
        handler=MockHandler, interval="1m", environment_id=None, filters=None
    )

    print(f"Query1: {query1}")
    print(f"Hash1: {hash(query1)}")

    # Test with filters
    filters = [{"key1": "value1"}, {"key2": "value2"}]
    query2 = UniqueConditionQuery(
        handler=MockHandler, interval="1m", environment_id=None, filters=filters
    )

    print(f"Query2: {query2}")
    print(f"Hash2: {hash(query2)}")

    # Test as dict key
    test_dict = {query1: "value1", query2: "value2"}
    print(f"Dict test passed: {test_dict}")


if __name__ == "__main__":
    test_basic()
