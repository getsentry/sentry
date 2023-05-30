from __future__ import annotations

import logging
import pickle

from django.db.models import TextField

from sentry.db.models.fields import jsonfield
from sentry.db.models.utils import Creator
from sentry.utils import json
from sentry.utils.strings import decompress

__all__ = ("GzippedDictField",)

logger = logging.getLogger("sentry")

PICKLE_WRITE_JSON = True
VALIDATE_JSON_SAMPLE_RATE = 1


def _validate_roundtrip(o: object) -> None:
    try:
        s = json.dumps(o, default=jsonfield.default)
    except Exception:
        raise TypeError(
            "Tried to serialize a pickle field with a value that cannot be serialized as JSON"
        )
    else:
        rt = json.loads(s)
        if o != rt:
            raise TypeError(
                f"json serialized database value was not the same after deserializing:\n"
                f"- {type(o)=}\n"
                f"- {type(rt)=}"
            )


class GzippedDictField(TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """

    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super().contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def to_python(self, value):
        try:
            if not value:
                return {}
            return json.loads(value)
        except (ValueError, TypeError):
            if isinstance(value, str) and value:
                try:
                    value = pickle.loads(decompress(value))
                except Exception as e:
                    logger.exception(e)
                    return {}
            elif not value:
                return {}
            return value

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def get_prep_value(self, value):
        if not value and self.null:
            # save ourselves some storage
            return None
        elif isinstance(value, bytes):
            value = value.decode("utf-8")
        if value is None and self.null:
            return None
        return json.dumps(value, default=jsonfield.default)

    def value_to_string(self, obj):
        return self.get_prep_value(self.value_from_object(obj))
