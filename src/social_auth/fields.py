import orjson
from django.core.exceptions import ValidationError
from django.db.models import TextField
from django.utils.encoding import smart_str

from sentry.db.models.utils import Creator


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
                return orjson.loads(value)
            except orjson.JSONDecodeError as e:
                raise ValidationError(str(e))
        else:
            return value

    def validate(self, value, model_instance):
        """Check value is a valid JSON string, raise ValidationError on
        error."""
        if isinstance(value, str):
            super().validate(value, model_instance)
            try:
                orjson.loads(value)
            except orjson.JSONDecodeError as e:
                raise ValidationError(str(e))

    def get_prep_value(self, value) -> str:
        """Convert value to JSON string before save"""
        try:
            return orjson.dumps(value, option=orjson.OPT_UTC_Z).decode()
        except orjson.JSONEncodeError as e:
            raise ValidationError(str(e))

    def value_to_string(self, obj):
        """Return value from object converted to string properly"""
        return smart_str(self.value_from_object(obj))

    def value_from_object(self, obj):
        """Return value dumped to string."""
        return self.get_prep_value(super().value_from_object(obj))
