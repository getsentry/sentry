from __future__ import absolute_import

from copy import copy
import logging
import six

from bitfield.types import BitHandler
from django.db import models
from django.db.models import signals
from django.db.models.query_utils import DeferredAttribute
from django.utils import timezone

from .fields.bounded import BoundedBigAutoField
from .manager import BaseManager
from .query import update

__all__ = ("BaseModel", "Model", "DefaultFieldsModel", "sane_repr")

UNSAVED = object()

DEFERRED = object()


def sane_repr(*attrs):
    if "id" not in attrs and "pk" not in attrs:
        attrs = ("id",) + attrs

    def _repr(self):
        cls = type(self).__name__

        pairs = ("%s=%s" % (a, repr(getattr(self, a, None))) for a in attrs)

        return u"<%s at 0x%x: %s>" % (cls, id(self), ", ".join(pairs))

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
        d.pop("_Model__data", None)
        return d

    def __hash__(self):
        # Django decided that it shouldn't let us hash objects even though they have
        # memory addresses. We need that behavior, so let's revert.
        if self.pk:
            return models.Model.__hash__(self)
        return id(self)

    def __reduce__(self):
        (model_unpickle, stuff, _) = super(BaseModel, self).__reduce__()
        return (model_unpickle, stuff, self.__getstate__())

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._update_tracked_data()

    def __get_field_value(self, field):
        if isinstance(type(field).__dict__.get(field.attname), DeferredAttribute):
            return DEFERRED
        if isinstance(field, models.ForeignKey):
            return getattr(self, field.column, None)
        return getattr(self, field.attname, None)

    def _update_tracked_data(self):
        "Updates a local copy of attributes values"
        if self.id:
            data = {}
            for f in self._meta.fields:
                # XXX(dcramer): this is how Django determines this (copypasta from Model)
                if (
                    isinstance(type(f).__dict__.get(f.attname), DeferredAttribute)
                    or f.column is None
                ):
                    continue
                try:
                    v = self.__get_field_value(f)
                except AttributeError as e:
                    # this case can come up from pickling
                    logging.exception(six.text_type(e))
                else:
                    if isinstance(v, BitHandler):
                        v = copy(v)
                    data[f.column] = v
            self.__data = data
        else:
            self.__data = UNSAVED

    def has_changed(self, field_name):
        "Returns ``True`` if ``field`` has changed since initialization."
        if self.__data is UNSAVED:
            return False
        field = self._meta.get_field(field_name)
        value = self.__get_field_value(field)
        if value is DEFERRED:
            return False
        return self.__data.get(field_name) != value

    def old_value(self, field_name):
        "Returns the previous value of ``field``"
        if self.__data is UNSAVED:
            return None
        value = self.__data.get(field_name)
        if value is DEFERRED:
            return None
        return self.__data.get(field_name)

    def bind_cached_fk(self, *rels):
        """
        Try to bind a foreign key relationship(s) in the
        most efficient way possible. If the relationship
        is already bound, do nothing.

        e.g. group.bind_cached_fk("project").project

        This would assert that group.project is now safe
        to use, and can be used in situation where you're unsure.

        Can also be chained.
        """
        for rel in rels:
            if rel[-3:] != "_id":
                rel_short = rel
                rel_full = rel + "_id"
            else:
                rel_full = rel
                rel_short = rel_full[:-3]
            cache_attr = "_%s_cache" % rel_short
            if hasattr(self, cache_attr):
                continue
            to = self._meta.get_field_by_name(rel_full)[0].rel.to
            pk = getattr(self, rel_full)
            if isinstance(to.objects, BaseManager):
                setattr(self, cache_attr, to.objects.get_from_cache(id=pk))
            else:
                setattr(self, cache_attr, to.objects.get(id=pk))
        return self


class Model(BaseModel):
    id = BoundedBigAutoField(primary_key=True)

    class Meta:
        abstract = True

    __repr__ = sane_repr("id")


class DefaultFieldsModel(Model):
    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        abstract = True


def __model_pre_save(instance, **kwargs):
    if not isinstance(instance, DefaultFieldsModel):
        return
    instance.date_updated = timezone.now()


def __model_post_save(instance, **kwargs):
    if not isinstance(instance, BaseModel):
        return
    instance._update_tracked_data()


def __model_class_prepared(sender, **kwargs):
    if not issubclass(sender, BaseModel):
        return

    if not hasattr(sender, "__core__"):
        raise ValueError(u"{!r} model has not defined __core__".format(sender))


signals.pre_save.connect(__model_pre_save)
signals.post_save.connect(__model_post_save)
signals.class_prepared.connect(__model_class_prepared)
