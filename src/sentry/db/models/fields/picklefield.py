from django.db.models.fields import TextField

from sentry.utils import json


class PickledObjectField(TextField):
    """Actually just json"""

    empty_strings_allowed = True

    def __init__(self, *args, **kwargs):
        # backward compat with django-picklefield definition
        kwargs.setdefault("editable", False)
        super().__init__(*args, **kwargs)

    def get_prep_value(self, value):
        if value is None and self.null:
            return None
        return json.dumps(value)

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value is None or isinstance(value, (int, float)):
            return value
        return json.loads(value, skip_trace=True)
