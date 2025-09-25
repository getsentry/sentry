from unittest import TestCase

import pytest

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.transformers import (
    TargetTypeConfigTransformer,
    action_target_strings,
    transform_config_schema_target_type_to_api,
)


class TestActionTargetStrings(TestCase):
    def test_action_target_strings(self) -> None:
        targets = [ActionTarget.USER, ActionTarget.TEAM, ActionTarget.ISSUE_OWNERS]
        result = action_target_strings(targets)

        expected = ["user", "team", "issue_owners"]
        assert result == expected

    def test_action_target_strings_single(self) -> None:
        targets = [ActionTarget.SPECIFIC]
        result = action_target_strings(targets)

        expected = ["specific"]
        assert result == expected

    def test_action_target_strings_empty(self) -> None:
        result = action_target_strings([])
        assert result == []


class TestTransformConfigSchemaTargetTypeToApi(TestCase):
    def test_transform_simple_schema(self) -> None:
        """Test transforming a simple config schema."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_identifier": {"type": "string"},
                "target_type": {
                    "type": "integer",
                    "enum": [ActionTarget.SPECIFIC.value],
                },
            },
            "required": ["target_type"],
        }

        result = transform_config_schema_target_type_to_api(config_schema)

        # Should convert integer target_type to string
        assert result["properties"]["target_type"]["type"] == "string"
        assert result["properties"]["target_type"]["enum"] == ["specific"]

        # Should preserve other fields
        assert result["properties"]["target_identifier"] == {"type": "string"}
        assert result["required"] == ["target_type"]

    def test_transform_multiple_target_types(self) -> None:
        """Test transforming schema with multiple target types."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "integer",
                    "enum": [
                        ActionTarget.USER.value,
                        ActionTarget.TEAM.value,
                        ActionTarget.ISSUE_OWNERS.value,
                    ],
                },
            },
        }

        result = transform_config_schema_target_type_to_api(config_schema)

        assert result["properties"]["target_type"]["type"] == "string"
        assert set(result["properties"]["target_type"]["enum"]) == {"user", "team", "issue_owners"}

    def test_transform_list_type(self) -> None:
        """Test transforming schema where target_type has list of types."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": ["integer", "null"],
                    "enum": [ActionTarget.SPECIFIC.value],
                },
            },
        }

        result = transform_config_schema_target_type_to_api(config_schema)

        assert result["properties"]["target_type"]["type"] == ["string", "null"]
        assert result["properties"]["target_type"]["enum"] == ["specific"]

    def test_no_properties(self) -> None:
        """Test schema without properties should raise ValueError."""
        config_schema = {"type": "object"}

        with pytest.raises(ValueError):
            transform_config_schema_target_type_to_api(config_schema)

    def test_no_target_type(self) -> None:
        """Test schema without target_type should raise ValueError."""
        config_schema = {
            "type": "object",
            "properties": {"other_field": {"type": "string"}},
        }

        with pytest.raises(ValueError):
            transform_config_schema_target_type_to_api(config_schema)

    def test_invalid_target_type_spec(self) -> None:
        """Test invalid target_type specification."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": "invalid",  # Should be a dict
            },
        }

        with pytest.raises(ValueError):
            transform_config_schema_target_type_to_api(config_schema)

    def test_missing_type(self) -> None:
        """Test target_type without type specification."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "enum": [ActionTarget.SPECIFIC.value],
                    # Missing "type"
                },
            },
        }

        with pytest.raises(ValueError):
            transform_config_schema_target_type_to_api(config_schema)

    def test_wrong_type(self) -> None:
        """Test target_type with non-integer type."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "string",
                    "enum": ["test"],
                },
            },
        }

        with pytest.raises(ValueError, match="target_type field must be of type 'integer'"):
            transform_config_schema_target_type_to_api(config_schema)

    def test_list_type_without_integer(self) -> None:
        """Test target_type with list type that doesn't include integer."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": ["string", "null"],
                    "enum": ["test"],
                },
            },
        }

        with pytest.raises(ValueError, match="target_type field must include 'integer' type"):
            transform_config_schema_target_type_to_api(config_schema)

    def test_missing_enum(self) -> None:
        """Test target_type without enum values."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "integer",
                    # Missing "enum"
                },
            },
        }

        with pytest.raises(ValueError):
            transform_config_schema_target_type_to_api(config_schema)

    def test_empty_enum(self) -> None:
        """Test target_type with empty enum."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "integer",
                    "enum": [],
                },
            },
        }

        with pytest.raises(ValueError, match="target_type enum must be a non-empty list"):
            transform_config_schema_target_type_to_api(config_schema)

    def test_non_integer_enum_value(self) -> None:
        """Test target_type with non-integer enum value."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "integer",
                    "enum": ["not_integer"],
                },
            },
        }

        with pytest.raises(ValueError):
            transform_config_schema_target_type_to_api(config_schema)

    def test_unknown_target_value(self) -> None:
        """Test target_type with unknown ActionTarget value."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "integer",
                    "enum": [999],  # Unknown ActionTarget value
                },
            },
        }

        with pytest.raises(ValueError, match="Unknown ActionTarget value: 999"):
            transform_config_schema_target_type_to_api(config_schema)


class TestTargetTypeConfigTransformerFromConfigSchema(TestCase):
    def test_from_config_schema_success(self) -> None:
        """Test successful creation from config schema."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "integer",
                    "enum": [ActionTarget.SPECIFIC.value],
                },
            },
        }

        transformer = TargetTypeConfigTransformer.from_config_schema(config_schema)

        assert transformer is not None
        assert transformer.api_schema["properties"]["target_type"]["type"] == "string"
        assert transformer.api_schema["properties"]["target_type"]["enum"] == ["specific"]

    def test_from_config_schema_no_target_type(self) -> None:
        """Test returns None when no target_type field."""
        config_schema = {
            "type": "object",
            "properties": {
                "other_field": {"type": "string"},
            },
        }

        with pytest.raises(ValueError):
            TargetTypeConfigTransformer.from_config_schema(config_schema)

    def test_from_config_schema_invalid_structure(self) -> None:
        """Test returns None for invalid structure."""
        # No properties
        with pytest.raises(ValueError):
            TargetTypeConfigTransformer.from_config_schema({"type": "object"})

        # Properties not dict
        with pytest.raises(ValueError):
            TargetTypeConfigTransformer.from_config_schema({"properties": "not_dict"})

    def test_from_config_schema_invalid_target_type_raises(self) -> None:
        """Test raises ValueError for invalid target_type field."""
        config_schema = {
            "type": "object",
            "properties": {
                "target_type": {
                    "type": "string",  # Wrong type
                    "enum": ["test"],
                },
            },
        }

        with pytest.raises(ValueError):
            TargetTypeConfigTransformer.from_config_schema(config_schema)
