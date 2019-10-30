from __future__ import absolute_import, print_function

import six

from django.db import models

from sentry.utils import json


# Adapted from django-pgfields
# https://github.com/lukesneeringer/django-pgfields/blob/master/django_pg/models/fields/array.py
class ArrayField(models.Field):
    def __init__(self, of=models.TextField, **kwargs):
        # Arrays in PostgreSQL are arrays of a particular type.
        # Save the subtype in our field class.
        if isinstance(of, type):
            of = of()
        self.of = of

        # Set "null" to True. Arrays don't have nulls, but null=True
        # in the ORM amounts to nothing in SQL (whereas null=False
        # corresponds to `NOT NULL`)
        kwargs["null"] = True

        super(ArrayField, self).__init__(**kwargs)

    def db_type(self, connection):
        engine = connection.settings_dict["ENGINE"]
        if "postgres" in engine:
            return u"{}[]".format(self.of.db_type(connection))
        return super(ArrayField, self).db_type(connection)

    def get_internal_type(self):
        return "TextField"

    def to_python(self, value):
        if not value:
            value = []
        if isinstance(value, six.text_type):
            value = json.loads(value)
        return map(self.of.to_python, value)

    def get_db_prep_value(self, value, connection, prepared=False):
        if not prepared:
            engine = connection.settings_dict["ENGINE"]
            if "postgres" in engine:
                return value
            return json.dumps(value) if value else None
        return value

    def get_prep_lookup(self, lookup_type, value):
        raise NotImplementedError(
            u"{!r} lookup type for {!r} is not supported".format(lookup_type, self)
        )


if hasattr(models, "SubfieldBase"):
    ArrayField = six.add_metaclass(models.SubfieldBase)(ArrayField)
