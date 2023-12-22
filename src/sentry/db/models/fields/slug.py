from django.core.exceptions import ValidationError
from django.db.models import SlugField


class NoNumericValidator:
    def __call__(self, value: str):
        if value.isnumeric():
            raise ValidationError("Value cannot be entirely numeric.")


class SentrySlugField(SlugField):
    default_validators = list(SlugField.default_validators) + [NoNumericValidator()]
