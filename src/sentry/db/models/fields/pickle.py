from __future__ import absolute_import

import six

from django.conf import settings
from picklefield.fields import PickledObjectField


class UnicodePickledObjectField(PickledObjectField):
    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, six.binary_type):
            value = value.decode('utf-8')
        return super(UnicodePickledObjectField, self).get_db_prep_value(value, *args, **kwargs)


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules

    add_introspection_rules([], ["^sentry\.db\.models\.fields\.pickle\.UnicodePickledObjectField"])
