"""
sentry.utils.models
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import hashlib
import logging

from django.db import models, router, transaction, IntegrityError
from django.db.models import signals
from django.db.models.expressions import ExpressionNode
from django.utils.encoding import smart_str

from sentry.utils.compat import pickle
from sentry.utils.db import resolve_expression_node
from sentry.utils.strings import decompress, compress

logger = logging.getLogger(__name__)


class QueryError(Exception):
    pass


def merge_account(from_user, to_user):
    # TODO: we could discover relations automatically and make this useful
    from sentry.models import (GroupBookmark, Project, ProjectKey, Team, TeamMember,
        UserOption)

    for obj in ProjectKey.objects.filter(user=from_user):
        obj.update(user=to_user)
    for obj in TeamMember.objects.filter(user=from_user):
        obj.update(user=to_user)
    for obj in Project.objects.filter(owner=from_user):
        obj.update(owner=to_user)
    for obj in Team.objects.filter(owner=from_user):
        obj.update(owner=to_user)
    for obj in GroupBookmark.objects.filter(user=from_user):
        obj.update(user=to_user)
    for obj in UserOption.objects.filter(user=from_user):
        obj.update(user=to_user)


def update(self, using=None, **kwargs):
    """
    Updates specified attributes on the current instance.
    """
    assert self.pk, "Cannot update an instance that has not yet been created."

    using = using or router.db_for_write(self.__class__, instance=self)

    for field in self._meta.fields:
        if getattr(field, 'auto_now', False) and field.name not in kwargs:
            kwargs[field.name] = field.pre_save(self, False)

    affected = self.__class__._base_manager.using(using).filter(pk=self.pk).update(**kwargs)
    for k, v in kwargs.iteritems():
        if isinstance(v, ExpressionNode):
            v = resolve_expression_node(self, v)
        setattr(self, k, v)
    if affected == 1:
        signals.post_save.send(sender=self.__class__, instance=self, created=False)
        return True
    elif affected == 0:
        return False
    elif affected < 0:
        raise ValueError("Somehow we have updated a negative amount of rows, you seem to have a problem with your db backend.")
    else:
        raise ValueError("Somehow we have updated multiple rows, and you are now royally fucked.")

update.alters_data = True


def __prep_value(model, key, value):
    if isinstance(value, models.Model):
        value = value.pk
    else:
        value = unicode(value)
    return value


def __prep_key(model, key):
    if key == 'pk':
        return model._meta.pk.name
    return key


def make_key(model, prefix, kwargs):
    kwargs_bits = []
    for k, v in sorted(kwargs.iteritems()):
        k = __prep_key(model, k)
        v = smart_str(__prep_value(model, k, v))
        kwargs_bits.append('%s=%s' % (k, v))
    kwargs_bits = ':'.join(kwargs_bits)

    return '%s:%s:%s' % (prefix, model.__name__, hashlib.md5(kwargs_bits).hexdigest())


def create_or_update(model, using=None, **kwargs):
    """
    Similar to get_or_create, either updates a row or creates it.

    The result will be (rows affected, False), if the row was not created,
    or (instance, True) if the object is new.

    >>> create_or_update(MyModel, key='value', defaults={
    >>>     'value': F('value') + 1,
    >>> })
    """
    defaults = kwargs.pop('defaults', {})

    if not using:
        using = router.db_for_write(model)

    objects = model.objects.using(using)

    affected = objects.filter(**kwargs).update(**defaults)
    if affected:
        return affected, False

    create_kwargs = kwargs.copy()
    inst = objects.model()
    for k, v in defaults.iteritems():
        if isinstance(v, ExpressionNode):
            create_kwargs[k] = resolve_expression_node(inst, v)
        else:
            create_kwargs[k] = v
    try:
        return objects.create(**create_kwargs), True
    except IntegrityError:
        transaction.rollback_unless_managed(using=using)
        affected = objects.filter(**kwargs).update(**defaults)

    if not affected:
        raise QueryError('No rows updated or created for kwargs: %r' % kwargs)

    return affected, False


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
            value = int(value)
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


class GzippedDictField(models.TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """
    __metaclass__ = models.SubfieldBase

    def to_python(self, value):
        if isinstance(value, basestring) and value:
            try:
                value = pickle.loads(decompress(value))
            except Exception, e:
                logger.exception(e)
                return {}
        elif not value:
            return {}
        return value

    def get_prep_value(self, value):
        if not value and self.null:
            # save ourselves some storage
            return None
        return compress(pickle.dumps(value))

    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.TextField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)


class Model(models.Model):
    id = BoundedAutoField(primary_key=True)

    class Meta:
        abstract = True

    update = update
    __UNSAVED = object()

    def __init__(self, *args, **kwargs):
        super(Model, self).__init__(*args, **kwargs)
        self._update_tracked_data()

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_Model__data', None)
        return d

    def __reduce__(self):
        (model_unpickle, stuff, _) = super(Model, self).__reduce__()
        return (model_unpickle, stuff, self.__getstate__())

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._update_tracked_data()

    def __get_field_value(self, field):
        if isinstance(field, models.ForeignKey):
            return getattr(self, field.column)
        return getattr(self, field.name)

    def _update_tracked_data(self):
        "Updates a local copy of attributes values"

        if self.id:
            self.__data = dict((f.column, self.__get_field_value(f)) for f in self._meta.fields)
        else:
            self.__data = self.__UNSAVED

    def has_changed(self, field_name):
        "Returns ``True`` if ``field`` has changed since initialization."
        if self.__data is self.__UNSAVED:
            return False
        field = self._meta.get_field(field_name)
        return self.__data.get(field_name) != self.__get_field_value(field)

    def old_value(self, field_name):
        "Returns the previous value of ``field``"
        if self.__data is self.__UNSAVED:
            return None
        return self.__data.get(field_name)


def __model_post_save(instance, **kwargs):
    if not isinstance(instance, Model):
        return
    instance._update_tracked_data()

signals.post_save.connect(__model_post_save)
