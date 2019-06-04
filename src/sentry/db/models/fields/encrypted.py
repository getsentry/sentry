from __future__ import absolute_import

__all__ = (
    'EncryptedCharField', 'EncryptedJsonField', 'EncryptedPickledObjectField', 'EncryptedTextField',
)

import six

from django.conf import settings
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
        super(EncryptedCharField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def get_db_prep_value(self, value, *args, **kwargs):
        value = super(EncryptedCharField, self).get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, six.string_types):
            value = decrypt(value)
        return super(EncryptedCharField, self).to_python(value)

    def get_prep_lookup(self, lookup_type, value):
        raise NotImplementedError(
            u'{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            )
        )


class EncryptedJsonField(JSONField):
    def get_db_prep_value(self, value, *args, **kwargs):
        value = super(EncryptedJsonField, self).get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, six.string_types):
            value = decrypt(value)
        return super(EncryptedJsonField, self).to_python(value)

    def get_prep_lookup(self, lookup_type, value):
        raise NotImplementedError(
            u'{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            )
        )


class EncryptedPickledObjectField(PickledObjectField):
    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, six.binary_type):
            value = value.decode('utf-8')
        value = super(EncryptedPickledObjectField, self).get_db_prep_value(value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, six.string_types):
            value = decrypt(value)
        return super(EncryptedPickledObjectField, self).to_python(value)

    def get_prep_lookup(self, lookup_type, value):
        raise NotImplementedError(
            u'{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            )
        )


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

    def get_prep_lookup(self, lookup_type, value):
        raise NotImplementedError(
            u'{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            )
        )


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules

    add_introspection_rules(
        [], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedPickledObjectField"]
    )
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedCharField"])
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedJsonField"])
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedTextField"])
