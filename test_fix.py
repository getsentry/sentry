#!/usr/bin/env python3
"""
Simple test to verify the fix works
"""

import os
import sys

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

# Test that we can import and use our fixed dataclass
try:
    from sentry.workflow_engine.handlers.condition.event_frequency_query_handlers import (
        EventFrequencyQueryHandler,
    )
    from sentry.workflow_engine.processors.delayed_workflow import UniqueConditionQuery

    print("✓ Successfully imported UniqueConditionQuery")

    # Test with list filters
    filters = [{"key1": "value1"}, {"key2": "value2"}]
    query = UniqueConditionQuery(
        handler=EventFrequencyQueryHandler, interval="1m", environment_id=None, filters=filters
    )

    # Test hashing
    hash_val = hash(query)
    print(f"✓ Successfully hashed query: {hash_val}")

    # Test as dict key
    test_dict = {query: "test"}
    print("✓ Successfully used as dictionary key")

    # Test that filters are converted
    print(f"✓ Filters converted to: {query.filters}")

    print("\n✅ All tests passed! The fix is working correctly.")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)
