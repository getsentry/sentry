from typing import Any

from django.forms import ValidationError
from jsonschema import ValidationError as JsonValidationError
from jsonschema import validate


def validate_json_schema(value, schema):
    try:
        validate(value, schema)
    except JsonValidationError as e:
        raise ValidationError(str(e))

    return value


def validate_json_primitive(value):
    if isinstance(value, (dict, list)):
        raise ValidationError(
            f"Invalid json primitive value: {value}. Must be a string, number, or boolean."
        )

    return value


def remove_items_by_api_input(
    input_data: list[dict[str, Any]], instance: Any, values_list_field: str
) -> None:
    data_ids = {int(item["id"]) for item in input_data if item.get("id") is not None}
    stored_ids = set(instance.values_list(values_list_field, flat=True))
    has_items_removed = data_ids != stored_ids

    if has_items_removed:
        filter_kwargs = {f"{values_list_field}__in": data_ids}
        instance.exclude(**filter_kwargs).delete()
