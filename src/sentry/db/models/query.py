"""
sentry.db.query
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import router, transaction, IntegrityError
from django.db.models.expressions import ExpressionNode
from django.db.models.signals import post_save

from .utils import resolve_expression_node

__all__ = ('update', 'create_or_update')


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
        post_save.send(sender=self.__class__, instance=self, created=False)
        return True
    elif affected == 0:
        return False
    elif affected < 0:
        raise ValueError("Somehow we have updated a negative amount of rows, you seem to have a problem with your db backend.")
    else:
        raise ValueError("Somehow we have updated multiple rows, and you are now royally fucked.")

update.alters_data = True


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

    return affected, False
