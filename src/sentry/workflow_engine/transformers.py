from __future__ import annotations

import copy
from typing import int, Any

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.types import ConfigTransformer
from sentry.workflow_engine.utils import dictpath


def action_target_strings(lst: list[ActionTarget]) -> list[str]:
    """Convert a list of ActionTarget enums to their string representations."""
    action_target_to_string = dict(ActionTarget.as_choices())
    return [action_target_to_string[a] for a in lst]


def _transform_target_type_spec(target_type_spec: dict[str, Any]) -> dict[str, Any]:
    """
    Transform a single target_type field specification from integer enum to string enum.

    Args:
        target_type_spec: Target type specification dict

    Returns:
        Transformed target type specification with string enums
    """
    # Extract type specification (may not be present in some nested contexts)
    type_spec_result = dictpath.walk(target_type_spec, "type")

    # Handle cases where type is not specified (e.g., in allOf.if.properties)
    if type_spec_result.failed():
        type_spec = None
    else:
        type_spec = type_spec_result.get()

    # Validate type if present
    if type_spec is not None:
        # Handle both single type and list of types
        if isinstance(type_spec, list):
            if "integer" not in type_spec:
                raise ValueError("target_type field must include 'integer' type")
        elif type_spec != "integer":
            raise ValueError("target_type field must be of type 'integer'")

    # Extract enum values
    enum_values = dictpath.walk(target_type_spec, "enum").list_of(int).get()
    if len(enum_values) == 0:
        raise ValueError("target_type enum must be a non-empty list")

    # Convert integer enum values to ActionTarget instances for validation
    action_targets = []
    for val in enum_values:
        # Find the ActionTarget that matches this integer value
        matching_target = None
        for target in ActionTarget:
            if target.value == val:
                matching_target = target
                break
        if matching_target is None:
            raise ValueError(f"Unknown ActionTarget value: {val}")
        action_targets.append(matching_target)

    # Create transformed specification
    api_target_type_spec = copy.deepcopy(target_type_spec)

    # Convert type from integer to string if present
    if type_spec is not None:
        if isinstance(type_spec, list):
            # Replace "integer" with "string" in the type list
            api_type_spec: list[str] | str = [t if t != "integer" else "string" for t in type_spec]
        else:
            api_type_spec = "string"
        api_target_type_spec["type"] = api_type_spec

    # Always convert enum values to strings
    api_target_type_spec["enum"] = action_target_strings(action_targets)

    return api_target_type_spec


def _transform_target_type_in_specific_locations(
    schema_dict: dict[str, Any],
) -> tuple[dict[str, Any], bool]:
    """
    Transform target_type fields in specific known locations:
    1. Top-level properties.target_type
    2. allOf[].if.properties.target_type
    """
    result = copy.deepcopy(schema_dict)
    transformed = False

    # 1. Transform top-level properties.target_type
    if (
        target_type_spec := dictpath.walk(result, "properties", "target_type")
        .is_type(dict)
        .get_or_none()
    ):
        result["properties"]["target_type"] = _transform_target_type_spec(target_type_spec)
        transformed = True

    # 2. Transform allOf[].if.properties.target_type
    if all_of_list := dictpath.walk(result, "allOf").list_of(dict).get_or_none():
        for i, item in enumerate(all_of_list):
            if (
                target_type_spec := dictpath.walk(item, "if", "properties", "target_type")
                .is_type(dict)
                .get_or_none()
            ):
                result["allOf"][i]["if"]["properties"]["target_type"] = _transform_target_type_spec(
                    target_type_spec
                )
                transformed = True

    return result, transformed


def transform_config_schema_target_type_to_api(config_schema: dict[str, Any]) -> dict[str, Any]:
    """
    Transform a config schema's target_type fields from integer enum to string enum.
    Raises:
        ValueError: If no target_type fields found or target_type field is malformed
    """
    transformed_schema, transformation_occurred = _transform_target_type_in_specific_locations(
        config_schema
    )

    # Check if any transformation actually occurred
    if not transformation_occurred:
        raise ValueError("No target_type fields found to transform - transformer is unnecessary")

    return transformed_schema


class TargetTypeConfigTransformer(ConfigTransformer):
    """Transforms target_type field between integer and string representations."""

    def __init__(self, api_schema: dict[str, Any]):
        self.api_schema = api_schema
        self.action_target_to_string = dict(ActionTarget.as_choices())
        self.action_target_from_string = {v: k for k, v in self.action_target_to_string.items()}

    @staticmethod
    def from_config_schema(config_schema: dict[str, Any]) -> TargetTypeConfigTransformer:
        """
        Analyze a config schema and generate a TargetTypeConfigTransformer if target_type field is found.
        """
        api_schema = transform_config_schema_target_type_to_api(config_schema)
        return TargetTypeConfigTransformer(api_schema)

    def from_api(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert from api format to config_schema format.
        Main transformation: target_type string -> target_type integer enum

        IMPORTANT: This method validates against the API schema (not config schema)
        to provide meaningful error messages about the actual API input that users
        sent, rather than our internal transformed representation. We assume the
        transformer logic is correct and focus on user-facing validation errors.
        """
        # Validate the API input against the API schema to catch user errors
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
