from __future__ import absolute_import, print_function

import six

from django.conf import settings
from django.db import models

from sentry.utils import json

SOUTH = 'south' in settings.INSTALLED_APPS


# Adapted from django-pgfields
# https://github.com/lukesneeringer/django-pgfields/blob/master/django_pg/models/fields/array.py
class ArrayField(models.Field):
    def __init__(self, of=models.TextField, **kwargs):
        # The `of` argument is a bit tricky once we need compatibility
        # with South.
        #
        # South can't store a field, and the eval it performs doesn't
        # put enough things in the context to use South's internal
        # "get field" function (`BaseMigration.gf`).
        #
        # Therefore, we need to be able to accept a South triple of our
        # sub-field and hook into South to get the correct thing back.
        if isinstance(of, tuple) and SOUTH:
            from south.utils import ask_for_it_by_name as gf
            of = gf(of[0])(*of[1], **of[2])

        # Arrays in PostgreSQL are arrays of a particular type.
        # Save the subtype in our field class.
        if isinstance(of, type):
            of = of()
        self.of = of

        # Set "null" to True. Arrays don't have nulls, but null=True
        # in the ORM amounts to nothing in SQL (whereas null=False
        # corresponds to `NOT NULL`)
        kwargs['null'] = True

        super(ArrayField, self).__init__(**kwargs)

    def db_type(self, connection):
        engine = connection.settings_dict['ENGINE']
        if 'postgres' in engine:
            return u'{}[]'.format(self.of.db_type(connection))
        return super(ArrayField, self).db_type(connection)

    def get_internal_type(self):
        return 'TextField'

    def to_python(self, value):
        if not value:
            value = []
        if isinstance(value, six.text_type):
            value = json.loads(value)
        return map(self.of.to_python, value)

    def get_db_prep_value(self, value, connection, prepared=False):
        if not prepared:
            engine = connection.settings_dict['ENGINE']
            if 'postgres' in engine:
                return value
            return json.dumps(value) if value else None
        return value

    def get_prep_lookup(self, lookup_type, value):
        raise NotImplementedError(
            u'{!r} lookup type for {!r} is not supported'.format(
                lookup_type,
                self,
            )
        )

    def south_field_triple(self):
        # It's safe to import South at this point; this method
        # will never actually be called unless South is installed.
        from south.modelsinspector import introspector

        # Get the args and kwargs with which this field was generated.
        # The "double" variable name is a riff of of South "triples", since
        #   the `introspector` function only returns the final two elements
        #   of a South triple. This is fine since those two pieces are all
        #   we actually need.
        double = introspector(self.of)

        # Return the appropriate South triple.
        return (
            '%s.%s' % (self.__class__.__module__, self.__class__.__name__),
            [],
            {
                # The `of` argument is *itself* another triple, of
                #   the internal field.
                # The ArrayField constructor understands how to resurrect
                #   its internal field from this serialized state.
                'of': (
                    u'{module}.{class_name}'.format(
                        module=self.of.__class__.__module__,
                        class_name=self.of.__class__.__name__,
                    ), double[0], double[1],
                ),
            },
        )


if hasattr(models, 'SubfieldBase'):
    ArrayField = six.add_metaclass(models.SubfieldBase)(ArrayField)
