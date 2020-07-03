from __future__ import absolute_import, print_function

import six

from django.db import models

from sentry.db.models.utils import Creator
from sentry.utils import json
from sentry.utils.compat import map


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

    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super(ArrayField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def db_type(self, connection):
        return u"{}[]".format(self.of.db_type(connection))

    def get_internal_type(self):
        return "TextField"

    def to_python(self, value):
        if not value:
            value = []
        if isinstance(value, six.text_type):
            value = json.loads(value)
        return map(self.of.to_python, value)
