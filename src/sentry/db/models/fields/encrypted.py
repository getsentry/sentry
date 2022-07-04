# This module used to implement encrypted fields.  These however were never really
# encrypted and the interface provided by them does not lend itself to useful
# encryption.  Since the main use of it was the `EncryptedPickledObjectField` in
# the codebase we want to phase out, this module only acts as a legacy shim at
# this point.


from django.db.models import CharField, TextField

from django_picklefield import PickledObjectField
from sentry.db.models.fields.jsonfield import JSONField


class EncryptedCharField(CharField):
    pass


class EncryptedJsonField(JSONField):
    pass


class EncryptedTextField(TextField):
    pass


class EncryptedPickledObjectField(PickledObjectField):
    empty_strings_allowed = True

    def get_db_prep_value(self, value, *args, **kwargs):
        # This special behavior is retained.
        if isinstance(value, bytes):
            value = value.decode("utf-8")
        return super().get_db_prep_value(value, *args, **kwargs)
