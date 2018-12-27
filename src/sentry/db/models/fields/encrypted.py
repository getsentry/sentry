from __future__ import absolute_import

__all__ = (
    'EncryptedCharField', 'EncryptedJsonField', 'EncryptedPickledObjectField', 'EncryptedTextField',
)

import six

from django.conf import settings
from django.db import models
from django.db.models import CharField, TextField
from jsonfield import JSONField
from picklefield.fields import PickledObjectField
from sentry.utils.encryption import decrypt, encrypt


class EncryptedCharField(CharField):
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


if hasattr(models, 'SubfieldBase'):
    EncryptedCharField = six.add_metaclass(models.SubfieldBase)(EncryptedCharField)
    EncryptedTextField = six.add_metaclass(models.SubfieldBase)(EncryptedTextField)

if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules

    add_introspection_rules(
        [], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedPickledObjectField"]
    )
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedCharField"])
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedJsonField"])
    add_introspection_rules([], ["^sentry\.db\.models\.fields\.encrypted\.EncryptedTextField"])
