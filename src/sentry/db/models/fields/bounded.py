"""
sentry.db.models.fields.bounded
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import
from django.db import models


__all__ = (
    'BoundedAutoField', 'BoundedBigAutoField', 'BoundedIntegerField',
    'BoundedBigIntegerField', 'BoundedPositiveIntegerField'
)


class BoundedAutoField(models.AutoField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value):
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super(BoundedAutoField, self).get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.AutoField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)


class BoundedBigAutoField(models.AutoField):
    MAX_VALUE = 9223372036854775807

    def db_type(self, connection):
        engine = connection.settings_dict['ENGINE']
        if 'mysql' in engine:
            return "bigint AUTO_INCREMENT"
        elif 'oracle' in engine:
            return "NUMBER(19)"
        elif 'postgres' in engine:
            return "bigserial"
        # SQLite doesnt actually support bigints with auto incr
        elif 'sqlite' in engine:
            return 'integer'
        else:
            raise NotImplemented

    def get_internal_type(self):
        return "BoundedBigAutoField"

    def get_prep_value(self, value):
        if value:
            value = long(value)
            assert value <= self.MAX_VALUE
        return super(BoundedBigAutoField, self).get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "sentry.db.models.fields.BoundedBigAutoField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)


class BoundedIntegerField(models.IntegerField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value):
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super(BoundedIntegerField, self).get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.IntegerField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)


class BoundedBigIntegerField(models.BigIntegerField):
    MAX_VALUE = 9223372036854775807

    def get_prep_value(self, value):
        if value:
            value = long(value)
            assert value <= self.MAX_VALUE
        return super(BoundedBigIntegerField, self).get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.BigIntegerField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)


class BoundedPositiveIntegerField(models.PositiveIntegerField):
    MAX_VALUE = 2147483647

    def get_prep_value(self, value):
        if value:
            value = int(value)
            assert value <= self.MAX_VALUE
        return super(BoundedPositiveIntegerField, self).get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.PositiveIntegerField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)
