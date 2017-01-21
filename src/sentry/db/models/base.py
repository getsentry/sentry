"""
sentry.db.models
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging
import six

from django.db import models
from django.db.models import signals

from .fields.bounded import BoundedBigAutoField
from .manager import BaseManager
from .query import update

__all__ = ('BaseModel', 'Model', 'sane_repr')

UNSAVED = object()


def sane_repr(*attrs):
    if 'id' not in attrs and 'pk' not in attrs:
        attrs = ('id',) + attrs

    def _repr(self):
        cls = type(self).__name__

        pairs = (
            '%s=%s' % (a, repr(getattr(self, a, None)))
            for a in attrs)

        return u'<%s at 0x%x: %s>' % (cls, id(self), ', '.join(pairs))

    return _repr


class BaseModel(models.Model):
    class Meta:
        abstract = True

    objects = BaseManager()

    update = update

    def __init__(self, *args, **kwargs):
        super(BaseModel, self).__init__(*args, **kwargs)
        self._update_tracked_data()

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_Model__data', None)
        return d

    def __reduce__(self):
        (model_unpickle, stuff, _) = super(BaseModel, self).__reduce__()
        return (model_unpickle, stuff, self.__getstate__())

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._update_tracked_data()

    def __get_field_value(self, field):
        if isinstance(field, models.ForeignKey):
            return getattr(self, field.column, None)
        return getattr(self, field.name, None)

    def _update_tracked_data(self):
        "Updates a local copy of attributes values"
        if self.id:
            data = {}
            for f in self._meta.fields:
                try:
                    data[f.column] = self.__get_field_value(f)
                except AttributeError as e:
                    # this case can come up from pickling
                    logging.exception(six.text_type(e))
            self.__data = data
        else:
            self.__data = UNSAVED

    def has_changed(self, field_name):
        "Returns ``True`` if ``field`` has changed since initialization."
        if self.__data is UNSAVED:
            return False
        field = self._meta.get_field(field_name)
        return self.__data.get(field_name) != self.__get_field_value(field)

    def old_value(self, field_name):
        "Returns the previous value of ``field``"
        if self.__data is UNSAVED:
            return None
        return self.__data.get(field_name)


class Model(BaseModel):
    id = BoundedBigAutoField(primary_key=True)

    class Meta:
        abstract = True

    __repr__ = sane_repr('id')


def __model_post_save(instance, **kwargs):
    if not isinstance(instance, BaseModel):
        return
    instance._update_tracked_data()


def __model_class_prepared(sender, **kwargs):
    if not issubclass(sender, BaseModel):
        return

    if not hasattr(sender, '__core__'):
        raise ValueError('{!r} model has not defined __core__'.format(sender))


signals.post_save.connect(__model_post_save)
signals.class_prepared.connect(__model_class_prepared)
