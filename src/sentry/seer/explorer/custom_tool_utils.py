from __future__ import annotations

import importlib
from abc import ABC, abstractmethod
from enum import StrEnum
from typing import Any, Literal, int

from pydantic import BaseModel

from sentry.models.organization import Organization
from sentry.seer.explorer.client_models import CustomToolDefinition


class ExplorerParamType(StrEnum):
    """Allowed parameter types for Explorer tools."""

    STRING = "string"
    INTEGER = "integer"
    NUMBER = "number"
    BOOLEAN = "boolean"
    ARRAY = "array"


# Type specifications for different parameter types
class StringType(BaseModel):
    """Simple string type."""

    kind: Literal["string"] = "string"


class IntegerType(BaseModel):
    """Simple integer type."""

    kind: Literal["integer"] = "integer"


class NumberType(BaseModel):
    """Simple number (float) type."""

    kind: Literal["number"] = "number"


class BooleanType(BaseModel):
    """Simple boolean type."""

    kind: Literal["boolean"] = "boolean"


class EnumType(BaseModel):
    """String restricted to specific values."""

    kind: Literal["enum"] = "enum"
    values: list[str]


class ArrayType(BaseModel):
    """Array with typed elements."""

    kind: Literal["array"] = "array"
    item_type: ExplorerParamType


ParamTypeSpec = StringType | IntegerType | NumberType | BooleanType | EnumType | ArrayType


class ExplorerToolParam(BaseModel):
    """Parameter definition for an Explorer tool.

    Examples:
        # String parameter
        ExplorerToolParam(
            name="query",
            description="Search query",
            type=StringType()
        )

        # Array of strings
        ExplorerToolParam(
            name="tags",
            description="List of tags",
            type=ArrayType(item_type=ExplorerParamType.STRING)
        )

        # Enum parameter
        ExplorerToolParam(
            name="status",
            description="Status",
            type=EnumType(values=["active", "inactive"])
        )
    """

    name: str
    description: str
    type: ParamTypeSpec
    required: bool = True


class ExplorerTool(ABC):
    """Base class for custom Explorer tools.

    Example:
        class DeploymentStatusTool(ExplorerTool):
            @classmethod
            def get_description(cls) -> str:
                return "Check if a service is deployed in an environment"

            @classmethod
            def get_params(cls) -> list[ExplorerToolParam]:
                return [
                    ExplorerToolParam(
                        name="environment",
                        description="Environment name",
                        type=StringType(),
                    ),
                    ExplorerToolParam(
                        name="service",
                        description="Service name",
                        type=StringType(),
                    ),
                ]

            @classmethod
            def execute(cls, organization: Organization, **kwargs) -> str:
                return check_deployment(organization, kwargs["environment"], kwargs["service"])
    """

    @classmethod
    @abstractmethod
    def get_description(cls) -> str:
        """Return a description of what this tool does."""
        ...

    @classmethod
    @abstractmethod
    def get_params(cls) -> list[ExplorerToolParam]:
        """Return the list of parameter definitions for this tool."""
        ...

    @classmethod
    @abstractmethod
    def execute(cls, organization: Organization, **kwargs) -> str:
        """Execute the tool with the given organization and parameters."""
        ...

    @classmethod
    def get_module_path(cls) -> str:
        """Get the full module path for this tool class."""
        if not hasattr(cls, "__module__") or not hasattr(cls, "__name__"):
            raise ValueError(f"Tool class {cls} must have __module__ and __name__ attributes")
        if not cls.__module__ or not cls.__name__:
            raise ValueError(f"Tool class {cls} has empty __module__ or __name__")
        return f"{cls.__module__}.{cls.__name__}"


def extract_tool_schema(tool_class: type[ExplorerTool]) -> CustomToolDefinition:
    """Extract tool schema from an ExplorerTool class.

    Args:
        tool_class: A class that inherits from ExplorerTool

    Returns:
        CustomToolDefinition with the tool's name, description, parameters, and module path
    """
    # Enforce module-level classes only (no nested classes)
    if "." in tool_class.__qualname__:
        raise ValueError(
            f"Tool class {tool_class.__name__} must be a module-level class. "
            f"Nested classes are not supported. (qualname: {tool_class.__qualname__})"
        )

    params = tool_class.get_params()

    # Convert ExplorerToolParam list to parameter dicts
    parameters: list[dict[str, Any]] = []
    required: list[str] = []
    for param in params:
        param_dict: dict[str, Any] = {
            "name": param.name,
            "description": param.description,
        }

        # Extract type information based on the type spec
        type_spec = param.type
        if isinstance(type_spec, EnumType):
            param_dict["type"] = "string"
            param_dict["enum"] = type_spec.values
        elif isinstance(type_spec, ArrayType):
            param_dict["type"] = "array"
            param_dict["items"] = {"type": type_spec.item_type.value}
        else:
            # Simple types: StringType, IntegerType, etc.
            param_dict["type"] = type_spec.kind

        parameters.append(param_dict)

        # Track required parameters
        if param.required:
            required.append(param.name)

    description = tool_class.get_description()

    return CustomToolDefinition(
        name=tool_class.__name__,
        module_path=tool_class.get_module_path(),
        description=description,
        parameters=parameters,
        required=required,
    )


def call_custom_tool(
    *,
    module_path: str,
    organization_id: int,
    allowed_prefixes: tuple[str, ...] = ("sentry.",),
    **kwargs: Any,
) -> str:
    """Dynamically import and call a custom tool class.

    Args:
        module_path: Full module path to the tool class (e.g., "sentry.api.MyTool")
        organization_id: Organization ID to load and pass to the tool
        allowed_prefixes: Tuple of allowed module path prefixes for security
        **kwargs: Tool parameters to pass to the tool's execute() method

    Returns:
        str: The result from the tool's execute() method
    """
    # Only allow imports from approved package prefixes
    if not any(module_path.startswith(prefix) for prefix in allowed_prefixes):
        raise ValueError(
            f"Module path must start with one of {allowed_prefixes}, got: {module_path}"
        )

    # Load the organization
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        raise ValueError(f"Organization with id {organization_id} does not exist")

    # Split module path and class name
    parts = module_path.rsplit(".", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid module path: {module_path}")

    module_name, class_name = parts

    # Import the tool class
    try:
        module = importlib.import_module(module_name)
        tool_class = getattr(module, class_name)
    except (ImportError, AttributeError) as e:
        raise ValueError(f"Could not import {module_path}: {e}")

    # Validate it's an ExplorerTool subclass
    if not isinstance(tool_class, type) or not issubclass(tool_class, ExplorerTool):
        raise ValueError(f"{module_path} must be a class that inherits from ExplorerTool")

    # Execute the tool
    try:
        result = tool_class.execute(organization, **kwargs)
    except Exception as e:
        raise RuntimeError(f"Error executing custom tool {module_path}: {e}")

    # Validate return type
    if not isinstance(result, str):
        raise RuntimeError(f"Custom tool {module_path} must return str, got {type(result)}")

    return result
