from __future__ import annotations

import copy
from typing import Any

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.types import ConfigTransformer


def _tname(t: type | tuple[type, ...]) -> str:
    if isinstance(t, type):
        return t.__name__
    return " | ".join(t.__name__ for t in t)


class Result:
    """
    A dictpath result. May not be successful.
    """

    def __init__(
        self, path: list[str], v: object | None = None, exc: ValueError | None = None
    ) -> None:
        self._path = path
        self._v = v
        self._exc = exc

    def expect(self, t: type | tuple[type, ...]) -> Result:
        if self.failed():
            return self
        if not isinstance(self._v, t):
            return Result(
                self._path,
                exc=ValueError(
                    f"{'.'.join(self._path)}: Expected {_tname(t)}, got {_tname(type(self._v))}"
                ),
            )
        return self

    def failed(self) -> bool:
        return self._exc is not None

    def get(self, fallback: object | None = None) -> object | None:
        if self._exc:
            if fallback is not None:
                return fallback
            raise self._exc
        return self._v


def dictpath(data: object, *path: str) -> Result:
    """
    Traverse an object based on a path and return a result.
    """
    current = data
    history = []
    for pathelt in path:
        history.append(pathelt)
        if not isinstance(current, dict):
            return Result(history, exc=ValueError(f"{'.'.join(history)} was not a dict!"))
        if pathelt not in current:
            return Result(history, exc=ValueError(f"{'.'.join(history)} not found!"))
        current = current[pathelt]
    return Result(history, v=current)


def action_target_strings(lst: list[ActionTarget]) -> list[str]:
    """Convert a list of ActionTarget enums to their string representations."""
    action_target_to_string = dict(ActionTarget.as_choices())
    return [action_target_to_string[a] for a in lst]


def transform_config_schema_target_type_to_api(config_schema: dict[str, Any]) -> dict[str, Any]:
    """
    Transform a config schema's target_type field from integer enum to string enum.

    Args:
        config_schema: Schema with integer target_type field

    Returns:
        New schema with string target_type field

    Raises:
        ValueError: If target_type field is malformed or contains invalid enum values
    """
    target_type_spec = dictpath(config_schema, "properties", "target_type").expect(dict).get()
    assert isinstance(target_type_spec, dict)

    # Extract type specification
    type_spec = dictpath(target_type_spec, "type").get()
    if type_spec is None:
        raise ValueError("target_type field must have a 'type' specification")

    # Handle both single type and list of types
    if isinstance(type_spec, list):
        if "integer" not in type_spec:
            raise ValueError("target_type field must include 'integer' type")
    elif type_spec != "integer":
        raise ValueError("target_type field must be of type 'integer'")

    # Extract enum values
    enum_values = dictpath(target_type_spec, "enum").expect(list).get()
    assert isinstance(enum_values, list)  # For mypy, already validated by expect(list)
    if len(enum_values) == 0:
        raise ValueError("target_type enum must be a non-empty list")

    # Convert integer enum values to ActionTarget instances for validation
    try:
        action_targets = []
        for val in enum_values:
            if not isinstance(val, int):
                raise ValueError(f"All enum values must be integers, got: {val}")
            # Find the ActionTarget that matches this integer value
            matching_target = None
            for target in ActionTarget:
                if target.value == val:
                    matching_target = target
                    break
            if matching_target is None:
                raise ValueError(f"Unknown ActionTarget value: {val}")
            action_targets.append(matching_target)
    except Exception as e:
        raise ValueError(f"Failed to process target_type enum values: {e}")

    # Generate API schema by copying config schema and transforming target_type field
    api_schema = copy.deepcopy(config_schema)

    # Replace target_type specification with string version
    api_target_type_spec = copy.deepcopy(target_type_spec)
    assert isinstance(api_target_type_spec, dict)  # For mypy

    # Convert type from integer to string
    if isinstance(type_spec, list):
        # Replace "integer" with "string" in the type list
        api_type_spec: list[str] | str = [t if t != "integer" else "string" for t in type_spec]
    else:
        api_type_spec = "string"

    api_target_type_spec["type"] = api_type_spec
    api_target_type_spec["enum"] = action_target_strings(action_targets)

    api_schema["properties"]["target_type"] = api_target_type_spec

    return api_schema


class TargetTypeConfigTransformer(ConfigTransformer):
    """Transforms target_type field between integer and string representations."""

    def __init__(self, api_schema: dict[str, Any]):
        self.api_schema = api_schema
        self.action_target_to_string = dict(ActionTarget.as_choices())
        self.action_target_from_string = {v: k for k, v in self.action_target_to_string.items()}

    @staticmethod
    def from_config_schema(config_schema: dict[str, Any]) -> TargetTypeConfigTransformer | None:
        """
        Analyze a config schema and generate a TargetTypeConfigTransformer if target_type field is found.
        """
        target_type_result = dictpath(config_schema, "properties", "target_type")
        if target_type_result.failed():
            return None

        # Use the extracted transformation function
        api_schema = transform_config_schema_target_type_to_api(config_schema)
        return TargetTypeConfigTransformer(api_schema)

    def from_api(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert from api format to config_schema format.
        Main transformation: target_type string -> target_type integer enum
        """
        # First validate the input against api_schema
        validate_json_schema(config, self.api_schema)

        # Create a copy to avoid mutating the input
        transformed_config = config.copy()

        # Convert target_type from string to ActionTarget enum value
        if "target_type" in transformed_config:
            target_type_str = transformed_config["target_type"]
            transformed_config["target_type"] = self.action_target_from_string[target_type_str]

        return transformed_config

    def to_api(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert from config_schema format to api format.
        Main transformation: target_type integer enum -> target_type string
        """
        # Create a copy to avoid mutating the input
        transformed_config = config.copy()

        # Convert target_type from ActionTarget enum value to string
        if "target_type" in transformed_config:
            target_type_enum = transformed_config["target_type"]
            transformed_config["target_type"] = self.action_target_to_string[target_type_enum]

        return transformed_config
