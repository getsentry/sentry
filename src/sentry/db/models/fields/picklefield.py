import django_picklefield
from sentry.utils import json


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

    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, bytes):
            value = value.decode("utf-8")
        if value is None and self.null:
            return None
        return json.dumps(value)

    def to_python(self, value):
        if value is None:
            return None
        try:
            return json.loads(value, skip_trace=True)
        except (ValueError, TypeError):
            from sentry.utils import metrics

            try:
                table = self.model.__name__  # not always present for unbound
            except AttributeError:
                table = "(unknown)"

            metrics.incr(
                "pickle.pickled_object_field_fallback",
                tags={"pickle_field_table": table},
                sample_rate=1,
            )
            return super().to_python(value)
