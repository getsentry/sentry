__all__ = (
    "EncryptedCharField",
    "EncryptedJsonField",
    "EncryptedPickledObjectField",
    "EncryptedTextField",
)


from django.db.models import CharField, TextField
from picklefield.fields import PickledObjectField

from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.utils import Creator
from sentry.utils.encryption import decrypt, encrypt


class EncryptedCharField(CharField):
    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super().contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def get_db_prep_value(self, value, *args, **kwargs):
        value = super().get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, str):
            value = decrypt(value)
        return super().to_python(value)


class EncryptedJsonField(JSONField):
    def get_db_prep_value(self, value, *args, **kwargs):
        value = super().get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, str):
            value = decrypt(value)
        return super().to_python(value)


class EncryptedPickledObjectField(PickledObjectField):
    empty_strings_allowed = True

    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, bytes):
            value = value.decode("utf-8")
        value = super().get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, str):
            value = decrypt(value)
        return super().to_python(value)


class EncryptedTextField(TextField):
    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super().contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def get_db_prep_value(self, value, *args, **kwargs):
        value = super().get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, str):
            value = decrypt(value)
        return super().to_python(value)
