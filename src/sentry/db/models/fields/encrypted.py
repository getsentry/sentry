from __future__ import absolute_import

__all__ = (
    "EncryptedCharField",
    "EncryptedJsonField",
    "EncryptedPickledObjectField",
    "EncryptedTextField",
)

import six

from django.db.models import CharField, TextField
from picklefield.fields import PickledObjectField, dbsafe_decode, PickledObject, _ObjectWrapper
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.utils import Creator
from sentry.utils.encryption import decrypt, encrypt


class EncryptedCharField(CharField):
    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super(EncryptedCharField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def get_db_prep_value(self, value, *args, **kwargs):
        value = super(EncryptedCharField, self).get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, six.string_types):
            value = decrypt(value)
        return super(EncryptedCharField, self).to_python(value)


class EncryptedJsonField(JSONField):
    def get_db_prep_value(self, value, *args, **kwargs):
        value = super(EncryptedJsonField, self).get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, six.string_types):
            value = decrypt(value)
        return super(EncryptedJsonField, self).to_python(value)


class EncryptedPickledObjectField(PickledObjectField):
    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, six.binary_type):
            value = value.decode("utf-8")
        value = super(EncryptedPickledObjectField, self).get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, six.string_types):
            value = decrypt(value)

        # The following below is a copypaste of PickledObjectField.to_python of
        # v1.0.0 with one change: We re-raise any baseexceptions such as
        # signals. 1.0.0 has a bare `except:` which causes issues.

        if value is not None:
            try:
                value = dbsafe_decode(value, self.compress)
            except Exception:
                # If the value is a definite pickle; and an error is raised in
                # de-pickling it should be allowed to propagate.
                if isinstance(value, PickledObject):
                    raise
            else:
                if isinstance(value, _ObjectWrapper):
                    return value._obj

        return value


class EncryptedTextField(TextField):
    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super(EncryptedTextField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def get_db_prep_value(self, value, *args, **kwargs):
        value = super(EncryptedTextField, self).get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, six.string_types):
            value = decrypt(value)
        return super(EncryptedTextField, self).to_python(value)
