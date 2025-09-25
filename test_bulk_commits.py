#!/usr/bin/env python3
"""
Simple syntax and import validation for the bulk commit processing.
This file tests that our changes don't break the basic import structure.
"""

import sys
import os

# Add the source directory to Python path
sys.path.insert(0, '/repo/getsentry/sentry/src')

try:
    # Test basic imports
    from sentry.models.releases.set_commits import bulk_set_commits, set_commits_on_release
    from sentry.models.commit import Commit
    from sentry.models.releasecommit import ReleaseCommit
    from sentry.models.commitfilechange import CommitFileChange
    
    print("✓ All imports successful")
    
    # Test that the bulk_set_commits function exists and has the right signature
    import inspect
    sig = inspect.signature(bulk_set_commits)
    expected_params = ['commit_list', 'release']
    actual_params = list(sig.parameters.keys())
    
    if actual_params == expected_params:
        print("✓ bulk_set_commits function has correct signature")
    else:
        print(f"✗ bulk_set_commits signature mismatch. Expected: {expected_params}, Got: {actual_params}")
        sys.exit(1)
    
    # Test that the function can handle empty list
    result = bulk_set_commits([], None)
    if result == []:
        print("✓ bulk_set_commits handles empty list correctly")
    else:
        print(f"✗ bulk_set_commits should return empty list for empty input, got: {result}")
        sys.exit(1)
    
    print("✓ All basic validations passed")
    
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Unexpected error: {e}")
    sys.exit(1)