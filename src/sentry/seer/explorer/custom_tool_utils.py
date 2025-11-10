from __future__ import annotations

import importlib
import inspect
import types
from collections.abc import Callable
from typing import Any, Union, get_args, get_origin, get_type_hints

from pydantic import ValidationError, create_model

from sentry.seer.explorer.client_models import CustomToolDefinition


def _is_valid_return_type(annotation: Any) -> bool:
    """Check if return type annotation is str or str | None."""
    # Direct str type
    if annotation is str:
        return True

    # Union type (str | None or Optional[str])
    origin = get_origin(annotation)
    if origin is Union or (hasattr(types, "UnionType") and isinstance(annotation, types.UnionType)):
        args = get_args(annotation)
        # Must be exactly (str, None) or (None, str)
        if len(args) == 2 and str in args and type(None) in args:
            return True

    return False


def get_module_path(func: Callable) -> str:
    """Get the full module path for a function."""
    if not hasattr(func, "__module__") or not hasattr(func, "__name__"):
        raise ValueError(f"Function {func} must have __module__ and __name__ attributes")

    if not func.__module__ or not func.__name__:
        raise ValueError(f"Function {func} has empty __module__ or __name__")

    return f"{func.__module__}.{func.__name__}"


def extract_tool_schema(func: Callable) -> CustomToolDefinition:
    """
    Extract tool schema from a function.

    The function must be a module-level function (not a lambda, class method, or nested function).
    """
    # Enforce module-level functions only
    if func.__name__ == "<lambda>":
        raise ValueError(
            "Lambda functions are not supported as custom tools. Please use a named module-level function instead."
        )
    if "." in func.__qualname__:
        # Module-level: __qualname__ == "func_name" (no dots)
        # Method: __qualname__ == "ClassName.method_name" (has dot)
        # Nested: __qualname__ == "outer.<locals>.inner" (has dot)
        raise ValueError(
            f"Function {func.__name__} must be a module-level function. Class methods and nested functions are not supported. (qualname: {func.__qualname__})"
        )

    sig = inspect.signature(func)

    # Resolve type hints (handles string annotations from __future__ import annotations)
    try:
        type_hints = get_type_hints(func)
    except Exception as e:
        raise ValueError(f"Failed to resolve type hints for {func.__name__}: {e}")

    # Validate return type
    if sig.return_annotation is inspect.Signature.empty:
        raise ValueError(
            f"Function {func.__name__} must have a return type annotation (must return str or str | None)"
        )

    # Use resolved return type from type_hints
    return_type = type_hints.get("return", sig.return_annotation)
    if not _is_valid_return_type(return_type):
        raise ValueError(
            f"Function {func.__name__} must return str or str | None, got {return_type}"
        )

    # Validate all parameters have annotations and build Pydantic model fields
    fields: dict[str, Any] = {}
    for param_name, param in sig.parameters.items():
        if param.annotation is inspect.Parameter.empty:
            raise ValueError(
                f"Parameter '{param_name}' in {func.__name__} must have a type annotation"
            )
        # Use resolved type from type_hints if available, otherwise use raw annotation
        annotation = type_hints.get(param_name, param.annotation)
        default = ... if param.default is inspect.Parameter.empty else param.default
        fields[param_name] = (annotation, default)

    if not fields:
        raise ValueError(f"Function {func.__name__} must have at least one parameter")

    # Let Pydantic validate the types by creating a model
    # This will raise if types are invalid (e.g., unsupported types)
    try:
        DynamicModel = create_model(f"{func.__name__}_Model", **fields)
    except (ValidationError, TypeError, RuntimeError) as e:
        raise ValueError(f"Invalid parameter types in {func.__name__}: {e}")

    # Get JSON schema from Pydantic
    pydantic_schema = DynamicModel.schema()

    # Convert Pydantic schema to Seer's tool parameter format
    parameters = []
    for param_name, param_schema in pydantic_schema.get("properties", {}).items():
        param_dict = {"name": param_name, "description": f"Parameter {param_name}"}
        if "type" in param_schema:
            param_dict["type"] = param_schema["type"]
        if "items" in param_schema:
            param_dict["items"] = param_schema["items"]

        parameters.append(param_dict)

    # Extract description from docstring
    description = "No description provided"
    if func.__doc__:
        description = func.__doc__.strip()

    return CustomToolDefinition(
        name=func.__name__,
        module_path=get_module_path(func),
        description=description,
        parameters=parameters,
        required=pydantic_schema.get("required", []),
    )


def call_custom_tool(module_path: str, **kwargs: Any) -> str:
    """Dynamically import and call a custom tool function."""
    # Only allow imports from sentry package (and test modules for testing)
    if not module_path.startswith("sentry.") and not module_path.startswith("tests.sentry."):
        raise ValueError(
            f"Module path must start with 'sentry.' or 'tests.sentry.', got: {module_path}"
        )

    # Split module path and function name
    parts = module_path.rsplit(".", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid module path: {module_path}")

    module_name, func_name = parts

    try:
        module = importlib.import_module(module_name)
        func = getattr(module, func_name)
    except (ImportError, AttributeError) as e:
        raise ValueError(f"Could not import {module_path}: {e}")

    if not callable(func):
        raise ValueError(f"{module_path} is not callable")

    # Call the function
    result = func(**kwargs)

    # Validate return type
    if not isinstance(result, str) and result is not None:
        raise RuntimeError(f"Custom tool {module_path} must return str or None, got {type(result)}")

    return result or ""
