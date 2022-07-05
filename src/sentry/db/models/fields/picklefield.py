import django_picklefield


class PickledObjectField(django_picklefield.PickledObjectField):
    """Sentry specific changes to the regular pickle field is the
    changed handling for bytes (we do not allow them toplevel for
    historic reasons) and empty strings handling.

    This field should not be used for new code!
    """

    empty_strings_allowed = True

    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, bytes):
            value = value.decode("utf-8")
        return super().get_db_prep_value(value, *args, **kwargs)

    def to_python(self, value):
        return super().to_python(value)
