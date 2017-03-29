"""
sentry.db.models.fields.gzippeddict
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import logging
import six

from django.conf import settings
from django.db import models

from sentry.utils.compat import pickle
from sentry.utils.strings import decompress, compress

__all__ = ('GzippedDictField',)

logger = logging.getLogger('sentry')


class GzippedDictField(models.TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """
    def to_python(self, value):
        if isinstance(value, six.string_types) and value:
            try:
                value = pickle.loads(decompress(value))
            except Exception as e:
                logger.exception(e)
                return {}
        elif not value:
            return {}
        return value

    def get_prep_value(self, value):
        if not value and self.null:
            # save ourselves some storage
            return None
        # enforce six.text_type strings to guarantee consistency
        if isinstance(value, six.binary_type):
            value = six.text_type(value)
        # db values need to be in unicode
        return compress(pickle.dumps(value))

    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_prep_value(value)


if hasattr(models, 'SubfieldBase'):
    GzippedDictField = six.add_metaclass(models.SubfieldBase)(GzippedDictField)

if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules

    add_introspection_rules([], ["^sentry\.db\.models\.fields\.gzippeddict\.GzippedDictField"])
