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
            f"Invalid DataCondition.condition_result, {value}, must be a primitive value"
        )

    return value
