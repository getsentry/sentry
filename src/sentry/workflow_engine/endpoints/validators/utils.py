from django.forms import ValidationError
from jsonschema import ValidationError as JsonValidationError
from jsonschema import validate


def validate_json_schema(value, schema):
    try:
        validate(value, schema)
    except JsonValidationError as e:
        raise ValidationError(str(e))

    return value
