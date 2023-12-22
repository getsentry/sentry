from django.core.exceptions import ValidationError
from django.db.models import SlugField


def no_numeric_validator(value: str) -> None:
    if value.isnumeric():
        raise ValidationError("Value cannot be entirely numeric.")

    return None


class SentrySlugField(SlugField):
    default_validators = list(SlugField.default_validators) + [no_numeric_validator]
