from collections.abc import Callable, Iterable, Mapping
from typing import Any, TypeVar

from sentry.integrations.jira.models.create_issue_metadata import (
    JIRA_CUSTOM_FIELD_TYPES,
    JiraField,
    JiraSchemaTypes,
)
from sentry.shared_integrations.exceptions import IntegrationFormError


class JiraSchemaParseError(Exception):
    pass


def parse_number_field(num_str: Any) -> int | float:
    try:
        if isinstance(num_str, str) and "." in num_str:
            return float(num_str)

        return int(num_str)
    except ValueError:
        raise JiraSchemaParseError(f"Invalid number value provided for field: '{num_str}'")


TransformerType = Mapping[str, Callable[[Any], Any]]

T = TypeVar("T")


def identity_transformer(input_val: T) -> T:
    return input_val


def id_obj_transformer(input_val: Any) -> dict[str, Any]:
    return {"id": input_val}


def get_type_transformer_mappings(user_id_field: str) -> TransformerType:
    transformers = {
        JiraSchemaTypes.user.value: lambda x: {user_id_field: x},
        JiraSchemaTypes.issue_type.value: id_obj_transformer,
        JiraSchemaTypes.option.value: lambda x: {"value": x},
        JiraSchemaTypes.issue_link.value: lambda x: {"key": x},
        JiraSchemaTypes.project.value: id_obj_transformer,
        JiraSchemaTypes.number.value: parse_number_field,
        JiraSchemaTypes.priority.value: id_obj_transformer,
        JiraSchemaTypes.version.value: id_obj_transformer,
        JiraSchemaTypes.component: id_obj_transformer,
    }

    return transformers


def get_custom_field_transformer_mappings() -> TransformerType:
    transformers = {
        JIRA_CUSTOM_FIELD_TYPES["tempo_account"]: parse_number_field,
        JIRA_CUSTOM_FIELD_TYPES["sprint"]: parse_number_field,
        JIRA_CUSTOM_FIELD_TYPES["rank"]: id_obj_transformer,
    }

    return transformers


def get_transformer_for_field(
    type_transformers: TransformerType, custom_transformers: TransformerType, jira_field: JiraField
) -> Callable[[Any], Any]:
    transformer = None
    if jira_field.is_custom_field():
        assert jira_field.schema.custom
        transformer = custom_transformers.get(jira_field.schema.custom)

    if not transformer:
        field_type = jira_field.get_field_type()

        if field_type:
            transformer = type_transformers.get(field_type)

    if not transformer:
        transformer = identity_transformer

    return transformer


def transform_fields(
    user_id_field: str, jira_fields: Iterable[JiraField], **data
) -> Mapping[str, Any]:
    transformed_data = {}

    # Special handling for fields that don't map cleanly to the transformer logic
    data["summary"] = data.get("title")
    if labels := data.get("labels"):
        data["labels"] = [label.strip() for label in labels.split(",") if label.strip()]

    type_transformers = get_type_transformer_mappings(user_id_field)
    custom_field_transformers = get_custom_field_transformer_mappings()

    for field in jira_fields:
        field_data = data.get(field.key)

        # Skip any values that indicate no value should be provided.
        # We have some older alert templates with "" values, which will raise
        # if we don't skip them.
        if field_data is None or field_data == "":
            continue

        field_transformer = get_transformer_for_field(
            type_transformers, custom_field_transformers, field
        )

        try:
            # Handling for array types and their nested subtypes.
            # We have to skip this handling for `sprint` custom fields, as they
            # are the only `array` type that expects a number, not a list.
            if (
                field.schema.schema_type.lower() == JiraSchemaTypes.array
                and field.schema.custom != JIRA_CUSTOM_FIELD_TYPES["sprint"]
            ):
                transformed_value = []

                # Occasionally, our UI passes a string instead of a list, so we
                # have to just wrap it and hope it's in the correct format.
                if not isinstance(field_data, list):
                    field_data = [field_data]

                # Bulk transform the individual data fields
                for val in field_data:
                    transformed_value.append(field_transformer(val))
            else:
                transformed_value = field_transformer(field_data)

        except JiraSchemaParseError as e:
            raise IntegrationFormError(field_errors={field.name: str(e)}) from e

        if transformed_value is not None:
            transformed_data[field.key] = transformed_value

    return transformed_data
