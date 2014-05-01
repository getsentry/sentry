"""
sentry.db.models.fields.jsonlist
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.db import models

from sentry.utils import json

__all__ = ('JSONListField',)

logger = logging.getLogger('sentry.errors')


class JSONListField(models.TextField):
    __metaclass__ = models.SubfieldBase

    def to_python(self, value):
        if isinstance(value, basestring) and value:
            try:
                value = json.loads(value)
            except Exception as e:
                logger.exception(e)
                return []
        elif not value:
            return []
        return value

    def get_prep_value(self, value):
        if not value and self.null:
            # save ourselves some storage
            return None

        assert isinstance(value, (list, tuple))

        return json.dumps(value)

    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.TextField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)
