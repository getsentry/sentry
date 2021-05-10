from django.core.exceptions import ValidationError
from django.db.models import TextField
from django.utils.encoding import smart_text

from sentry.db.models.utils import Creator
from sentry.utils import json


class JSONField(TextField):
    """Simple JSON field that stores python structures as JSON strings
    on database.
    """

    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super().contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def to_python(self, value):
        """
        Convert the input JSON value into python structures, raises
        django.core.exceptions.ValidationError if the data can't be converted.
        """
        if self.blank and not value:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception as e:
                raise ValidationError(str(e))
        else:
            return value

    def validate(self, value, model_instance):
        """Check value is a valid JSON string, raise ValidationError on
        error."""
        if isinstance(value, str):
            super().validate(value, model_instance)
            try:
                json.loads(value)
            except Exception as e:
                raise ValidationError(str(e))

    def get_prep_value(self, value):
        """Convert value to JSON string before save"""
        try:
            return json.dumps(value)
        except Exception as e:
            raise ValidationError(str(e))

    def value_to_string(self, obj):
        """Return value from object converted to string properly"""
        return smart_text(self.value_from_object(obj))

    def value_from_object(self, obj):
        """Return value dumped to string."""
        return self.get_prep_value(super().value_from_object(obj))
