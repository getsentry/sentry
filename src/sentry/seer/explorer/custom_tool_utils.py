from __future__ import annotations

import importlib
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

from sentry.models.organization import Organization
from sentry.seer.explorer.client_models import CustomToolDefinition

ParamsT = TypeVar("ParamsT", bound=BaseModel)


class ExplorerTool(ABC, Generic[ParamsT]):
    """Base class for custom Explorer tools.

    Define parameters via a Pydantic model.

    Example:
        from pydantic import BaseModel, Field

        class DeploymentStatusParams(BaseModel):
            environment: str = Field(description="Environment name (e.g., 'production', 'staging')")
            service: str = Field(description="Service name")

        class DeploymentStatusTool(ExplorerTool[DeploymentStatusParams]):
            params_model = DeploymentStatusParams

            @classmethod
            def get_description(cls) -> str:
                return "Check if a service is deployed in an environment"

            @classmethod
            def execute(cls, organization: Organization, params: DeploymentStatusParams) -> str:
                return check_deployment(organization, params.environment, params.service)
    """

    # Define a Pydantic model for parameters
    params_model: type[ParamsT]

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        # Skip validation for abstract subclasses
        if ABC in cls.__bases__:
            return
        if not hasattr(cls, "params_model") or cls.params_model is None:
            raise TypeError(
                f"{cls.__name__} must define a params_model class attribute. "
                "Use an empty BaseModel if no parameters are needed."
            )
        if not isinstance(cls.params_model, type) or not issubclass(cls.params_model, BaseModel):
            raise TypeError(
                f"{cls.__name__}.params_model must be a Pydantic BaseModel subclass, "
                f"got {type(cls.params_model)}"
            )

    @classmethod
    @abstractmethod
    def get_description(cls) -> str:
        """Return a description of what this tool does."""
        ...

    @classmethod
    @abstractmethod
    def execute(cls, organization: Organization, params: ParamsT) -> str:
        """Execute the tool with the given organization and validated parameters."""
        ...

    @classmethod
    def get_module_path(cls) -> str:
        """Get the full module path for this tool class."""
        if not hasattr(cls, "__module__") or not hasattr(cls, "__name__"):
            raise ValueError(f"Tool class {cls} must have __module__ and __name__ attributes")
        if not cls.__module__ or not cls.__name__:
            raise ValueError(f"Tool class {cls} has empty __module__ or __name__")
        return f"{cls.__module__}.{cls.__name__}"


def extract_tool_schema(tool_class: type[ExplorerTool[Any]]) -> CustomToolDefinition:
    """Extract tool schema from an ExplorerTool class.

    Args:
        tool_class: A class that inherits from ExplorerTool

    Returns:
        CustomToolDefinition with the tool's name, description, param_schema, and module path
    """
    # Enforce module-level classes only (no nested classes)
    if "." in tool_class.__qualname__:
        raise ValueError(
            f"Tool class {tool_class.__name__} must be a module-level class. "
            f"Nested classes are not supported. (qualname: {tool_class.__qualname__})"
        )

    return CustomToolDefinition(
        name=tool_class.__name__,
        module_path=tool_class.get_module_path(),
        description=tool_class.get_description(),
        param_schema=tool_class.params_model.schema(),
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

    # Validate and parse params through the model
    try:
        params = tool_class.params_model(**kwargs)
    except Exception as e:
        raise ValueError(f"Invalid parameters for {module_path}: {e}")

    # Execute the tool
    try:
        result = tool_class.execute(organization, params)
    except Exception as e:
        raise RuntimeError(f"Error executing custom tool {module_path}: {e}")

    # Validate return type
    if not isinstance(result, str):
        raise RuntimeError(f"Custom tool {module_path} must return str, got {type(result)}")

    return result
