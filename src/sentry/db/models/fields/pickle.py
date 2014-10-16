from __future__ import absolute_import

from picklefield.fields import PickledObjectField


class UnicodePickledObjectField(PickledObjectField):
    def get_db_prep_value(self, value, *args, **kwargs):
        if isinstance(value, str):
            value = value.decode('utf-8')
        return super(UnicodePickledObjectField, self).get_db_prep_value(
            value, *args, **kwargs)
