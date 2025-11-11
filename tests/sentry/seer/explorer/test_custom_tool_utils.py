"""
Tests for custom tool utilities.
"""

from dataclasses import dataclass

import pytest

from sentry.seer.explorer.custom_tool_utils import (
    call_custom_tool,
    extract_tool_schema,
    get_module_path,
)
from sentry.testutils.cases import TestCase


# Test helper functions (defined in module scope so they can be imported by call_custom_tool)
def _test_custom_tool(message: str, count: int = 1) -> str:
    """A test tool."""
    return message * count


def _test_tool_with_default(value: str, suffix: str = "!") -> str:
    """Test tool with default parameter."""
    return value + suffix


def _tool_returns_none(flag: bool) -> str | None:
    """Tool that can return None."""
    return None if flag else "value"


def _bad_tool() -> str:
    """Tool that returns wrong type."""
    return 123  # type: ignore[return-value]


# Helper functions for schema extraction tests
def _get_user_info(user_id: int) -> str:
    """Fetches user information."""
    return f"User {user_id}"


def _search_logs(query: str, limit: int = 10, include_archived: bool = False) -> str:
    """Search application logs."""
    return f"Found logs for: {query}"


def _process_items(items: list[str], priorities: list[int]) -> str:
    """Process a list of items."""
    return "Processed"


# Helper functions for validation tests (these intentionally violate certain rules)
def _valid_tool(text: str, count: int = 5) -> str:
    """A valid tool."""
    return f"{text} {count}"


def _optional_tool(text: str) -> str | None:
    """Tool with optional return."""
    return text if text else None


def _no_annotation_tool(text) -> str:
    """Tool missing parameter annotation."""
    return str(text)


def _wrong_return_type_tool(text: str) -> int:
    """Tool with wrong return type."""
    return len(text)


def _no_return_annotation_tool(text: str):
    """Tool missing return annotation."""
    return text


@dataclass
class SampleData:
    name: str
    count: int


def _tool_with_dataclass(data: SampleData) -> str:
    """Tool that accepts a dataclass."""
    return f"{data.name}: {data.count}"


# Test nested primitive structures
def _tool_with_nested_list(items: list[dict[str, str]]) -> str:
    """Tool that accepts nested list of dicts."""
    return str(len(items))


def _tool_with_list_of_lists(matrix: list[list[int]]) -> str:
    """Tool that accepts list of lists."""
    return str(len(matrix))


def _tool_with_nested_dict(groups: dict[str, list[str]]) -> str:
    """Tool that accepts dict with list values."""
    return str(len(groups))


from typing import Literal


def _tool_with_enum(unit: Literal["celsius", "fahrenheit"]) -> str:
    """Tool with enum parameter."""
    return unit


class CustomToolUtilsTest(TestCase):
    def test_get_module_path(self):
        """Test extracting module path from function."""

        def my_test_function() -> str:
            return "test"

        path = get_module_path(my_test_function)
        assert path == f"{__name__}.my_test_function"

    def test_validate_tool_function_valid(self):
        """Test validation passes for valid functions."""
        # Should not raise (validation happens in extract_tool_schema)
        schema = extract_tool_schema(_valid_tool)
        assert schema.name == "_valid_tool"

    def test_validate_tool_function_no_return_annotation(self):
        """Test validation fails for function without return annotation."""
        with pytest.raises(ValueError) as cm:
            extract_tool_schema(_no_return_annotation_tool)
        assert "return type annotation" in str(cm.value)

    def test_validate_tool_function_wrong_return_type(self):
        """Test validation fails for non-string return type."""
        with pytest.raises(ValueError) as cm:
            extract_tool_schema(_wrong_return_type_tool)
        assert "must return str" in str(cm.value)

    def test_validate_tool_function_no_param_annotation(self):
        """Test validation fails for parameter without annotation."""
        with pytest.raises(ValueError) as cm:
            extract_tool_schema(_no_annotation_tool)
        assert "type annotation" in str(cm.value)

    def test_validate_tool_function_invalid_param_type(self):
        """Test validation fails for unsupported parameter types."""

        class CustomClass:
            pass

        def invalid_tool(data: CustomClass) -> str:
            return str(data)

        with pytest.raises(ValueError) as cm:
            extract_tool_schema(invalid_tool)
        assert "invalid" in str(cm.value).lower()

    def test_validate_tool_function_lambda(self):
        """Test validation fails for lambda functions."""
        lambda_func = lambda x: str(x)  # noqa: E731

        with pytest.raises(ValueError) as cm:
            extract_tool_schema(lambda_func)
        assert "lambda" in str(cm.value).lower()

    def test_validate_tool_function_class_method(self):
        """Test validation fails for class methods."""

        class MyClass:
            def my_method(self, text: str) -> str:
                return text

        instance = MyClass()
        with pytest.raises(ValueError) as cm:
            extract_tool_schema(instance.my_method)
        assert "module-level function" in str(cm.value)

    def test_validate_tool_function_nested_function(self):
        """Test validation fails for nested functions."""

        def outer():
            def inner(text: str) -> str:
                return text

            return inner

        nested_func = outer()
        with pytest.raises(ValueError) as cm:
            extract_tool_schema(nested_func)
        assert "module-level function" in str(cm.value)

    def test_validate_tool_function_optional_return(self):
        """Test validation passes for optional return type."""
        # Should not raise
        schema = extract_tool_schema(_optional_tool)
        assert schema.name == "_optional_tool"

    def test_extract_tool_schema_basic(self):
        """Test extracting schema from a basic function."""
        schema = extract_tool_schema(_get_user_info)

        assert schema.name == "_get_user_info"
        assert "_get_user_info" in schema.module_path
        assert schema.description == "Fetches user information."
        assert len(schema.parameters) == 1
        assert schema.parameters[0]["name"] == "user_id"
        assert schema.parameters[0]["type"] == "integer"
        assert schema.required == ["user_id"]

    def test_extract_tool_schema_with_optional_params(self):
        """Test extracting schema with optional parameters."""
        schema = extract_tool_schema(_search_logs)

        assert schema.name == "_search_logs"
        assert schema.description == "Search application logs."
        assert len(schema.parameters) == 3
        assert schema.required == ["query"]  # Only required param

        # Check parameter types
        param_types = {p["name"]: p["type"] for p in schema.parameters}
        assert param_types["query"] == "string"
        assert param_types["limit"] == "integer"
        assert param_types["include_archived"] == "boolean"

    def test_extract_tool_schema_with_list_params(self):
        """Test extracting schema with list parameters."""
        schema = extract_tool_schema(_process_items)

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
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils._test_custom_tool"

        # Call via the utility function
        result = call_custom_tool(
            module_path, allowed_prefixes=("sentry.", "tests.sentry."), message="Hi", count=3
        )
        assert result == "HiHiHi"

    def test_call_custom_tool_with_optional_param(self):
        """Test calling a custom tool with default parameter."""
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils._test_tool_with_default"
        result = call_custom_tool(
            module_path, allowed_prefixes=("sentry.", "tests.sentry."), value="Hello"
        )
        assert result == "Hello!"

    def test_call_custom_tool_security_restriction(self):
        """Test that only allowed prefixes module paths are allowed."""
        with pytest.raises(ValueError) as cm:
            call_custom_tool("os.system", command="ls")
        assert "must start with one of" in str(cm.value)
        assert "('sentry.',)" in str(cm.value)

    def test_call_custom_tool_invalid_path(self):
        """Test calling with invalid module path."""
        with pytest.raises(ValueError) as cm:
            call_custom_tool("sentry.nonexistent.module.function")
        assert "Could not import" in str(cm.value)

    def test_call_custom_tool_returns_none(self):
        """Test that None return values are converted to empty string."""
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils._tool_returns_none"
        result = call_custom_tool(
            module_path, allowed_prefixes=("sentry.", "tests.sentry."), flag=True
        )
        assert result == ""

    def test_call_custom_tool_wrong_return_type(self):
        """Test error when tool returns non-string."""
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils._bad_tool"
        with pytest.raises(RuntimeError) as cm:
            call_custom_tool(module_path, allowed_prefixes=("sentry.", "tests.sentry."))
        assert "must return str" in str(cm.value)

    def test_tool_with_dataclass_parameter(self):
        """Test that dataclasses are rejected because they're not supported by Seer."""
        # Dataclasses use JSON schema references ($ref or allOf) which Seer doesn't support
        with pytest.raises(ValueError) as cm:
            extract_tool_schema(_tool_with_dataclass)
        assert "Dataclasses and custom objects are not supported" in str(cm.value)

    def test_tool_with_nested_list_of_dicts(self):
        """Test that list[dict[str, str]] is supported via 'items' field."""
        schema = extract_tool_schema(_tool_with_nested_list)

        assert len(schema.parameters) == 1
        items_param = schema.parameters[0]
        assert items_param["name"] == "items"
        assert items_param["type"] == "array"
        assert "items" in items_param
        # The nested structure should be preserved in the items field
        assert items_param["items"]["type"] == "object"

    def test_tool_with_list_of_lists(self):
        """Test that list[list[int]] is supported via nested 'items'."""
        schema = extract_tool_schema(_tool_with_list_of_lists)

        assert len(schema.parameters) == 1
        matrix_param = schema.parameters[0]
        assert matrix_param["name"] == "matrix"
        assert matrix_param["type"] == "array"
        assert "items" in matrix_param
        # Nested list should have items too
        assert matrix_param["items"]["type"] == "array"
        assert matrix_param["items"]["items"]["type"] == "integer"

    def test_call_tool_with_nested_structures(self):
        """Test that nested structures work end-to-end."""
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils._tool_with_nested_list"

        # Call with nested data
        result = call_custom_tool(
            module_path,
            allowed_prefixes=("sentry.", "tests.sentry."),
            items=[{"name": "Alice", "age": "30"}, {"name": "Bob", "age": "25"}],
        )
        assert result == "2"

    def test_tool_with_enum(self):
        """Test that Literal types are converted to enum."""
        schema = extract_tool_schema(_tool_with_enum)

        assert len(schema.parameters) == 1
        unit_param = schema.parameters[0]
        assert unit_param["name"] == "unit"
        assert unit_param["type"] == "string"
        assert unit_param["enum"] == ["celsius", "fahrenheit"]
