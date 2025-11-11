"""
Tests for custom tool utilities.
"""

import pytest

from sentry.seer.explorer.custom_tool_utils import (
    ArrayType,
    BooleanType,
    EnumType,
    ExplorerParamType,
    ExplorerTool,
    ExplorerToolParam,
    IntegerType,
    StringType,
    call_custom_tool,
    extract_tool_schema,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import create_test_regions, region_silo_test


# Test helper tool classes (defined in module scope so they can be imported by call_custom_tool)
class TestCustomTool(ExplorerTool):
    def get_tool_description(self):
        return "A test tool"

    def get_params(self):
        return [
            ExplorerToolParam(name="message", description="Message to repeat", type=StringType()),
            ExplorerToolParam(
                name="count", description="Number of times", type=IntegerType(), required=False
            ),
        ]

    def execute(self, organization, **kwargs):
        message = kwargs["message"]
        count = kwargs.get("count", 1)
        return message * count


class TestToolWithDefault(ExplorerTool):
    def get_tool_description(self):
        return "Test tool with default parameter"

    def get_params(self):
        return [
            ExplorerToolParam(name="value", description="Value", type=StringType()),
            ExplorerToolParam(
                name="suffix", description="Suffix", type=StringType(), required=False
            ),
        ]

    def execute(self, organization, **kwargs):
        value = kwargs["value"]
        suffix = kwargs.get("suffix", "!")
        return value + suffix


class BadTool(ExplorerTool):
    def get_tool_description(self):
        return "Tool that returns wrong type"

    def get_params(self):
        return []

    def execute(self, organization, **kwargs):
        return 123  # Returns wrong type to test runtime validation


class GetUserInfoTool(ExplorerTool):
    def get_tool_description(self):
        return "Fetches user information"

    def get_params(self):
        return [
            ExplorerToolParam(name="user_id", description="User ID", type=IntegerType()),
        ]

    def execute(self, organization, **kwargs):
        return f"User {kwargs['user_id']}"


class SearchLogsTool(ExplorerTool):
    def get_tool_description(self):
        return "Search application logs"

    def get_params(self):
        return [
            ExplorerToolParam(name="query", description="Search query", type=StringType()),
            ExplorerToolParam(
                name="limit", description="Result limit", type=IntegerType(), required=False
            ),
            ExplorerToolParam(
                name="include_archived",
                description="Include archived",
                type=BooleanType(),
                required=False,
            ),
        ]

    def execute(self, organization, **kwargs):
        return f"Found logs for: {kwargs['query']}"


class ProcessItemsTool(ExplorerTool):
    def get_tool_description(self):
        return "Process a list of items"

    def get_params(self):
        return [
            ExplorerToolParam(
                name="items",
                description="Items to process",
                type=ArrayType(item_type=ExplorerParamType.STRING),
            ),
            ExplorerToolParam(
                name="priorities",
                description="Priorities",
                type=ArrayType(item_type=ExplorerParamType.INTEGER),
            ),
        ]

    def execute(self, organization, **kwargs):
        return "Processed"


class ToolWithNestedList(ExplorerTool):
    def get_tool_description(self):
        return "Tool that accepts nested list of dicts"

    def get_params(self):
        return [
            ExplorerToolParam(
                name="items",
                description="Items",
                type=ArrayType(item_type=ExplorerParamType.OBJECT),
            ),
        ]

    def execute(self, organization, **kwargs):
        return str(len(kwargs["items"]))


class ToolWithEnum(ExplorerTool):
    def get_tool_description(self):
        return "Tool with enum parameter"

    def get_params(self):
        return [
            ExplorerToolParam(
                name="unit",
                description="Temperature unit",
                type=EnumType(values=["celsius", "fahrenheit"]),
            ),
        ]

    def execute(self, organization, **kwargs):
        return kwargs["unit"]


@region_silo_test
class CustomToolUtilsTest(TestCase):
    def setUp(self):
        super().setUp()
        create_test_regions()
        self.organization = self.create_organization()

    def test_validate_tool_class_nested(self):
        """Test validation fails for nested classes."""

        class OuterClass:
            class NestedTool(ExplorerTool):
                def get_tool_description(self):
                    return "Nested tool"

                def get_params(self):
                    return []

                def execute(self, organization, **kwargs):
                    return "test"

        with pytest.raises(ValueError) as cm:
            extract_tool_schema(OuterClass.NestedTool)
        assert "module-level class" in str(cm.value)

    def test_extract_tool_schema_basic(self):
        """Test extracting schema from a basic tool class."""
        schema = extract_tool_schema(GetUserInfoTool)

        assert schema.name == "GetUserInfoTool"
        assert "GetUserInfoTool" in schema.module_path
        assert schema.description == "Fetches user information"
        assert len(schema.parameters) == 1
        assert schema.parameters[0]["name"] == "user_id"
        assert schema.parameters[0]["type"] == "integer"
        assert schema.required == ["user_id"]

    def test_extract_tool_schema_with_optional_params(self):
        """Test extracting schema with optional parameters."""
        schema = extract_tool_schema(SearchLogsTool)

        assert schema.name == "SearchLogsTool"
        assert schema.description == "Search application logs"
        assert len(schema.parameters) == 3
        assert schema.required == ["query"]  # Only required param

        # Check parameter types
        param_types = {p["name"]: p["type"] for p in schema.parameters}
        assert param_types["query"] == "string"
        assert param_types["limit"] == "integer"
        assert param_types["include_archived"] == "boolean"

    def test_extract_tool_schema_with_list_params(self):
        """Test extracting schema with list parameters."""
        schema = extract_tool_schema(ProcessItemsTool)

        assert len(schema.parameters) == 2

        # Check list types
        items_param = next(p for p in schema.parameters if p["name"] == "items")
        assert items_param["type"] == "array"
        assert items_param["items"]["type"] == "string"

        priorities_param = next(p for p in schema.parameters if p["name"] == "priorities")
        assert priorities_param["type"] == "array"
        assert priorities_param["items"]["type"] == "integer"

    def test_call_custom_tool_success(self):
        """Test calling a custom tool successfully."""
        # Use test tool from this test module
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils.TestCustomTool"

        # Call via the utility function
        result = call_custom_tool(
            module_path=module_path,
            allowed_prefixes=("sentry.", "tests.sentry."),
            organization_id=self.organization.id,
            message="Hi",
            count=3,
        )
        assert result == "HiHiHi"

    def test_call_custom_tool_with_optional_param(self):
        """Test calling a custom tool with default parameter."""
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils.TestToolWithDefault"
        result = call_custom_tool(
            module_path=module_path,
            allowed_prefixes=("sentry.", "tests.sentry."),
            organization_id=self.organization.id,
            value="Hello",
        )
        assert result == "Hello!"

    def test_call_custom_tool_security_restriction(self):
        """Test that only allowed prefixes module paths are allowed."""
        with pytest.raises(ValueError) as cm:
            call_custom_tool(
                module_path="os.system",
                organization_id=self.organization.id,
                command="ls",
            )
        assert "must start with one of" in str(cm.value)
        assert "('sentry.',)" in str(cm.value)

    def test_call_custom_tool_invalid_path(self):
        """Test calling with invalid module path."""
        with pytest.raises(ValueError) as cm:
            call_custom_tool(
                module_path="sentry.nonexistent.module.function",
                organization_id=self.organization.id,
            )
        assert "Could not import" in str(cm.value)

    def test_call_custom_tool_wrong_return_type(self):
        """Test error when tool returns non-string."""
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils.BadTool"
        with pytest.raises(RuntimeError) as cm:
            call_custom_tool(
                module_path=module_path,
                allowed_prefixes=("sentry.", "tests.sentry."),
                organization_id=self.organization.id,
            )
        assert "must return str" in str(cm.value)

    def test_tool_with_array_of_objects(self):
        """Test that list[dict] is supported via ArrayType."""
        schema = extract_tool_schema(ToolWithNestedList)

        assert len(schema.parameters) == 1
        items_param = schema.parameters[0]
        assert items_param["name"] == "items"
        assert items_param["type"] == "array"
        assert "items" in items_param
        assert items_param["items"]["type"] == "object"

    def test_call_tool_with_array_of_objects(self):
        """Test that arrays of objects work end-to-end."""
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils.ToolWithNestedList"

        # Call with array of dicts
        result = call_custom_tool(
            module_path=module_path,
            allowed_prefixes=("sentry.", "tests.sentry."),
            organization_id=self.organization.id,
            items=[{"name": "Alice", "age": "30"}, {"name": "Bob", "age": "25"}],
        )
        assert result == "2"

    def test_tool_with_enum(self):
        """Test that EnumType is converted correctly."""
        schema = extract_tool_schema(ToolWithEnum)

        assert len(schema.parameters) == 1
        unit_param = schema.parameters[0]
        assert unit_param["name"] == "unit"
        assert unit_param["type"] == "string"
        assert unit_param["enum"] == ["celsius", "fahrenheit"]
