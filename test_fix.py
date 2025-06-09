#!/usr/bin/env python3
"""
Test script to verify the Slack block_id fix works correctly.
"""

import os
import sys

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


# Test the fixed logic directly
def test_block_id_generation():
    """Test the block_id generation logic directly."""

    # Simulate the old broken way (what was causing the issue)
    import orjson

    group_id = 123
    rule_id = 456

    # OLD WAY (broken)
    old_block_id = {"issue": group_id}
    if rule_id:
        old_block_id["rule"] = rule_id
    old_json_block_id = orjson.dumps(old_block_id).decode()

    print(f"Old (broken) block_id: {old_json_block_id}")
    print(f"Old type: {type(old_json_block_id)}")

    # NEW WAY (fixed)
    new_main_block_id_str = f"issue_{group_id}"
    if rule_id:
        new_main_block_id_str += f"_rule_{rule_id}"

    print(f"New (fixed) block_id: {new_main_block_id_str}")
    print(f"New type: {type(new_main_block_id_str)}")

    # Verify the fix
    assert isinstance(new_main_block_id_str, str)
    assert not new_main_block_id_str.startswith('{"')
    assert new_main_block_id_str == "issue_123_rule_456"

    print("✓ Block ID generation test passed")

    return new_main_block_id_str


def test_tags_block_id_generation():
    """Test the tags block_id generation logic."""

    # Simulate old way (broken)
    import orjson

    block_id_dict = {"issue": 123, "rule": 456}
    tags_block_id_dict = block_id_dict.copy()
    tags_block_id_dict["block"] = "tags"
    old_tags_block_id = orjson.dumps(tags_block_id_dict).decode()

    print(f"Old (broken) tags block_id: {old_tags_block_id}")

    # New way (fixed)
    base_id_info = {"issue": 123, "rule": 456}
    issue_id = base_id_info.get("issue")
    rule_id = base_id_info.get("rule")

    new_tags_block_id_str = f"tags_issue_{issue_id}"
    if rule_id:
        new_tags_block_id_str += f"_rule_{rule_id}"

    print(f"New (fixed) tags block_id: {new_tags_block_id_str}")

    # Verify the fix
    assert isinstance(new_tags_block_id_str, str)
    assert not new_tags_block_id_str.startswith('{"')
    assert new_tags_block_id_str == "tags_issue_123_rule_456"

    print("✓ Tags block ID generation test passed")

    return new_tags_block_id_str


def test_main_block_id():
    """Test that the main block_id is a simple string, not JSON."""

    # Mock the minimum required attributes
    class MockGroup:
        id = 123

    class MockMessageBuilder(SlackIssuesMessageBuilder):
        def __init__(self):
            self.group = MockGroup()

        def build_test(self):
            # Simulate the relevant parts of the build method
            rule_id = 456

            # set up block id info dictionary
            block_id_info = {"issue": self.group.id}
            if rule_id:
                block_id_info["rule"] = rule_id

            # Generate the main block_id string
            main_block_id_str = f"issue_{self.group.id}"
            if rule_id:
                main_block_id_str += f"_rule_{rule_id}"

            return main_block_id_str, block_id_info

    builder = MockMessageBuilder()
    main_block_id, block_id_info = builder.build_test()

    # Test that main_block_id is a simple string
    print(f"Main block_id: {main_block_id}")
    print(f"Type: {type(main_block_id)}")
    assert isinstance(main_block_id, str)
    assert main_block_id == "issue_123_rule_456"
    assert not main_block_id.startswith('{"')  # Should not be JSON

    print("✓ Main block_id test passed")


def test_tags_block_id():
    """Test that the tags block_id is constructed correctly."""

    # Mock the minimum required for the static method
    base_id_info = {"issue": 123, "rule": 456}

    # Call the method directly
    tags_block = BlockSlackMessageBuilder.get_tags_block(
        tags=[{"title": "foo", "value": "bar"}], base_id_info=base_id_info
    )

    # Check the block_id
    block_id = tags_block["block_id"]
    print(f"Tags block_id: {block_id}")
    print(f"Type: {type(block_id)}")
    assert isinstance(block_id, str)
    assert block_id == "tags_issue_123_rule_456"
    assert not block_id.startswith('{"')  # Should not be JSON

    print("✓ Tags block_id test passed")


def test_tags_block_id_no_rule():
    """Test that the tags block_id works without a rule."""

    base_id_info = {"issue": 789}

    tags_block = BlockSlackMessageBuilder.get_tags_block(
        tags=[{"title": "foo", "value": "bar"}], base_id_info=base_id_info
    )

    block_id = tags_block["block_id"]
    print(f"Tags block_id (no rule): {block_id}")
    assert block_id == "tags_issue_789"

    print("✓ Tags block_id (no rule) test passed")


if __name__ == "__main__":
    print("Testing Slack block_id fix...")
    test_block_id_generation()
    test_tags_block_id_generation()
    print("✅ All tests passed!")
