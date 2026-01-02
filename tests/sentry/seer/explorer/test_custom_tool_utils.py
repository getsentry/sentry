"""
Tests for custom tool utilities.
"""

import pytest
from pydantic import BaseModel, Field

from sentry.seer.explorer.custom_tool_utils import (
    ExplorerTool,
    call_custom_tool,
    extract_tool_schema,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import create_test_regions, region_silo_test


# Pydantic models for tool parameters
class CustomToolParams(BaseModel):
    message: str = Field(description="Message to repeat")
    count: int = Field(default=1, description="Number of times")


class ToolWithDefaultParams(BaseModel):
    value: str = Field(description="Value")
    suffix: str = Field(default="!", description="Suffix")


class EmptyParams(BaseModel):
    pass


class GetUserInfoParams(BaseModel):
    user_id: int = Field(description="User ID")


class SearchLogsParams(BaseModel):
    query: str = Field(description="Search query")
    limit: int | None = Field(default=None, description="Result limit")
    include_archived: bool | None = Field(default=None, description="Include archived")


class ProcessItemsParams(BaseModel):
    items: list[str] = Field(description="Items to process")
    priorities: list[int] = Field(description="Priorities")


# Test helper tool classes (defined in module scope so they can be imported by call_custom_tool)
class SampleCustomTool(ExplorerTool[CustomToolParams]):
    params_model = CustomToolParams

    @classmethod
    def get_description(cls) -> str:
        return "A test tool"

    @classmethod
    def execute(cls, organization, params: CustomToolParams) -> str:
        return params.message * params.count


class SampleToolWithDefault(ExplorerTool[ToolWithDefaultParams]):
    params_model = ToolWithDefaultParams

    @classmethod
    def get_description(cls) -> str:
        return "Test tool with default parameter"

    @classmethod
    def execute(cls, organization, params: ToolWithDefaultParams) -> str:
        return params.value + params.suffix


class BadTool(ExplorerTool[EmptyParams]):
    params_model = EmptyParams

    @classmethod
    def get_description(cls) -> str:
        return "Tool that returns wrong type"

    @classmethod
    def execute(cls, organization, params: EmptyParams) -> str:
        return 123  # type: ignore[return-value]  # Returns wrong type to test runtime validation


class GetUserInfoTool(ExplorerTool[GetUserInfoParams]):
    params_model = GetUserInfoParams

    @classmethod
    def get_description(cls) -> str:
        return "Fetches user information"

    @classmethod
    def execute(cls, organization, params: GetUserInfoParams) -> str:
        return f"User {params.user_id}"


class SearchLogsTool(ExplorerTool[SearchLogsParams]):
    params_model = SearchLogsParams

    @classmethod
    def get_description(cls) -> str:
        return "Search application logs"

    @classmethod
    def execute(cls, organization, params: SearchLogsParams) -> str:
        return f"Found logs for: {params.query}"


class ProcessItemsTool(ExplorerTool[ProcessItemsParams]):
    params_model = ProcessItemsParams

    @classmethod
    def get_description(cls) -> str:
        return "Process a list of items"

    @classmethod
    def execute(cls, organization, params: ProcessItemsParams) -> str:
        return "Processed"


@region_silo_test
class CustomToolUtilsTest(TestCase):
    def setUp(self):
        super().setUp()
        create_test_regions()
        self.organization = self.create_organization()

    def test_validate_tool_class_nested(self):
        """Test validation fails for nested classes."""

        class OuterClass:
            class NestedTool(ExplorerTool[EmptyParams]):
                params_model = EmptyParams

                @classmethod
                def get_description(cls) -> str:
                    return "Nested tool"

                @classmethod
                def execute(cls, organization, params: EmptyParams) -> str:
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
        assert schema.param_schema is not None
        assert "properties" in schema.param_schema
        assert "user_id" in schema.param_schema["properties"]

    def test_extract_tool_schema_with_optional_params(self):
        """Test extracting schema with optional parameters."""
        schema = extract_tool_schema(SearchLogsTool)

        assert schema.name == "SearchLogsTool"
        assert schema.description == "Search application logs"
        assert schema.param_schema is not None
        properties = schema.param_schema["properties"]
        assert "query" in properties
        assert "limit" in properties
        assert "include_archived" in properties
        # Only query is required
        assert schema.param_schema.get("required") == ["query"]

    def test_extract_tool_schema_with_list_params(self):
        """Test extracting schema with list parameters."""
        schema = extract_tool_schema(ProcessItemsTool)

        assert schema.param_schema is not None
        properties = schema.param_schema["properties"]

        # Check list types
        assert properties["items"]["type"] == "array"
        assert properties["priorities"]["type"] == "array"

    def test_call_custom_tool_success(self):
        """Test calling a custom tool successfully."""
        # Use test tool from this test module
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils.SampleCustomTool"

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
        module_path = "tests.sentry.seer.explorer.test_custom_tool_utils.SampleToolWithDefault"
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

    def test_tool_without_params_model_raises(self):
        """Test that a tool without params_model raises an error at class definition time."""
        with pytest.raises(TypeError) as cm:
            # This should raise when the class is defined, not when extract_tool_schema is called
            class NoParamsTool(ExplorerTool[BaseModel]):
                @classmethod
                def get_description(cls) -> str:
                    return "Tool without params_model"

                @classmethod
                def execute(cls, organization, params: BaseModel) -> str:
                    return "test"

        assert "must define a params_model" in str(cm.value)
