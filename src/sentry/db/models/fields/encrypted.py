from __future__ import absolute_import

__all__ = (
    'EncryptedCharField',
    'EncryptedJsonField',
    'EncryptedPickledObjectField',
)

from django.db.models import CharField
from jsonfield import JSONField
from picklefield.fields import PickledObjectField
from sentry.utils.encryption import decrypt, encrypt


class EncryptedValueLookup(object):
    def __init__(self, name, value):
        self.name = name
        self.value = value

    def _as_sql(self, connection):
        col_name = connection.ops.quote_name(self.name)
        e_value = encrypt(self.value)
        if e_value == self.value:
            return '{} = %s'.format(col_name), [self.value]

        return '{} IN (%s, %s)'.format(col_name), (
            self.value,
            e_value,
        )


class EncryptedMultiValueLookup(EncryptedValueLookup):
    def _as_sql(self, connection):
        total_values = len(self.value) * 2

        params = []
        for i in xrange(total_values):
            params.append(self.value)
            e_value = encrypt(self.value)
            if e_value != self.value:
                params.append(e_value)

        return '{} IN ({})'.format(
            connection.ops.quote_name(self.name),
            ', '.join('%s' for i in xrange(len(params))),
        ), params


class EncryptedCharField(CharField):
    def get_db_prep_value(self, value, *args, **kwargs):
        value = super(EncryptedCharField, self).get_db_prep_value(
            value, *args, **kwargs)
        return encrypt(value)

    def get_prep_lookup(self, lookup_type, value):
        if lookup_type == 'in':
            return EncryptedMultiValueLookup(self.name, value)
        elif lookup_type == 'exact' and isinstance(value, basestring):
            return EncryptedValueLookup(self.name, value)
        else:
            raise NotImplementedError('{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            ))

    def to_python(self, value):
        if value is not None and isinstance(value, basestring):
            value = decrypt(value)
        return super(EncryptedCharField, self).to_python(value)


class EncryptedJsonField(JSONField):
    def get_db_prep_value(self, value, *args, **kwargs):
        value = super(EncryptedJsonField, self).get_db_prep_value(
            value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, basestring):
            value = decrypt(value)
        return super(EncryptedJsonField, self).to_python(value)

    def get_prep_lookup(self, lookup_type, value):
        if lookup_type == 'in':
            return EncryptedMultiValueLookup(self.name, value)
        elif lookup_type == 'exact' and isinstance(value, basestring):
            return EncryptedValueLookup(self.name, value)
        else:
            raise NotImplementedError('{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            ))


class EncryptedPickledObjectField(PickledObjectField):
    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, str):
            value = value.decode('utf-8')
        value = super(EncryptedPickledObjectField, self).get_db_prep_value(
            value, *args, **kwargs)
        return encrypt(value)

    def to_python(self, value):
        if value is not None and isinstance(value, basestring):
            value = decrypt(value)
        return super(EncryptedPickledObjectField, self).to_python(value)

    def get_prep_lookup(self, lookup_type, value):
        if lookup_type == 'in':
            return EncryptedMultiValueLookup(self.name, value)
        elif lookup_type == 'exact' and isinstance(value, basestring):
            return EncryptedValueLookup(self.name, value)
        else:
            raise NotImplementedError('{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            ))
