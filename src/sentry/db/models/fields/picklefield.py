from django.conf import settings

import django_picklefield
from sentry.db.models.fields import jsonfield
from sentry.utils import json

PICKLE_WRITE_JSON = False


class PickledObjectField(django_picklefield.PickledObjectField):
    """Sentry specific changes to the regular pickle field is the
    changed handling for bytes (we do not allow them toplevel for
    historic reasons) and empty strings handling.

    This will eventually move over to storing JSON behind the scenes
    and can already read JSON if it's placed in the database.  In
    tests it will already fail with an error if code tries to put
    values in there which cannot be serialized as JSON.
    """

    empty_strings_allowed = True

    def __init__(self, *args, **kwargs):
        self.write_json = kwargs.pop("write_json", PICKLE_WRITE_JSON)
        self.disable_pickle_validation = kwargs.pop("disable_pickle_validation", False)
        super().__init__(*args, **kwargs)

    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, bytes):
            value = value.decode("utf-8")
        if self.write_json:
            if value is None and self.null:
                return None
            return json.dumps(value, default=jsonfield.default)
        elif (
            settings.PICKLED_OBJECT_FIELD_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE
            and not self.disable_pickle_validation
        ):
            try:
                s = json.dumps(value, default=jsonfield.default)
            except Exception as e:
                raise TypeError(
                    "Tried to serialize a pickle field with a value that cannot be serialized as JSON: %s"
                    % (e,)
                )
            else:
                rt = json.loads(s)
                if value != rt:
                    raise TypeError(
                        f"json serialized database value was not the same after deserializing:\n"
                        f"- {type(value)=}\n"
                        f"- {type(rt)=}"
                    )

        return super().get_db_prep_value(value, *args, **kwargs)

    def to_python(self, value):
        try:
            if value is None:
                return None
            return json.loads(value)
        except (ValueError, TypeError):
            return super().to_python(value)
