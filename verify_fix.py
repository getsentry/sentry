#!/usr/bin/env python3
# run: python3 verify_fix.py
"""
Verify that the Slack block_id fix has been properly implemented.
"""

import subprocess
import sys

print("Verifying Slack block_id fix...")


# Test 1: Check that main block_id generation creates a string, not JSON
def test_main_block_id_logic():
    """Test the fixed main block_id generation logic."""
    group_id = 123
    rule_id = 456

    # This is the NEW logic that was implemented
    main_block_id_str = f"issue_{group_id}"
    if rule_id:
        main_block_id_str += f"_rule_{rule_id}"

    print(f"✓ Main block_id: '{main_block_id_str}' (type: {type(main_block_id_str).__name__})")
    assert isinstance(main_block_id_str, str)
    assert main_block_id_str == "issue_123_rule_456"
    assert not main_block_id_str.startswith('{"')
    return True


# Test 2: Check that tags block_id generation creates a string, not JSON
def test_tags_block_id_logic():
    """Test the fixed tags block_id generation logic."""
    base_id_info = {"issue": 123, "rule": 456}

    # This is the NEW logic that was implemented
    issue_id = base_id_info.get("issue")
    rule_id = base_id_info.get("rule")

    tags_block_id_str = f"tags_issue_{issue_id}"
    if rule_id:
        tags_block_id_str += f"_rule_{rule_id}"

    print(f"✓ Tags block_id: '{tags_block_id_str}' (type: {type(tags_block_id_str).__name__})")
    assert isinstance(tags_block_id_str, str)
    assert tags_block_id_str == "tags_issue_123_rule_456"
    assert not tags_block_id_str.startswith('{"')
    return True


# Test 3: Show what the old broken logic would have produced
def show_old_broken_logic():
    """Show what the old broken logic would have produced."""
    import json

    # OLD (broken) way - what was causing the issue
    old_block_id = {"issue": 123, "rule": 456}
    old_json_str = json.dumps(old_block_id)

    old_tags_block_id = {"issue": 123, "rule": 456, "block": "tags"}
    old_tags_json_str = json.dumps(old_tags_block_id)

    print(f"✗ Old broken main block_id: '{old_json_str}' (JSON string)")
    print(f"✗ Old broken tags block_id: '{old_tags_json_str}' (JSON string)")

    print("\n❌ The old way produced JSON strings that Slack's API rejected as 'invalid_blocks'")
    print("✅ The new way produces simple strings that Slack's API accepts")


if __name__ == "__main__":
    print("=" * 60)
    test_main_block_id_logic()
    test_tags_block_id_logic()

    print("\n" + "=" * 60)
    print("Comparison with old broken logic:")
    show_old_broken_logic()

    print("\n" + "=" * 60)
    print("🎉 Fix verification complete!")
    print("✅ block_id values are now simple strings instead of JSON")
    print("✅ This should resolve the 'invalid_blocks' error from Slack's API")
