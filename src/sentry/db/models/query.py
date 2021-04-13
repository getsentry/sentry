import itertools
from functools import reduce

from django.db import IntegrityError, router, transaction
from django.db.models import Model, Q
from django.db.models.expressions import CombinedExpression
from django.db.models.signals import post_save

from .utils import resolve_combined_expression

__all__ = ("update", "create_or_update")


def update(self, using=None, **kwargs):
    """
    Updates specified attributes on the current instance.
    """
    assert self.pk, "Cannot update an instance that has not yet been created."

    using = using or router.db_for_write(self.__class__, instance=self)

    for field in self._meta.fields:
        if getattr(field, "auto_now", False) and field.name not in kwargs:
            kwargs[field.name] = field.pre_save(self, False)

    affected = self.__class__._base_manager.using(using).filter(pk=self.pk).update(**kwargs)
    for k, v in kwargs.items():
        if isinstance(v, CombinedExpression):
            v = resolve_combined_expression(self, v)
        setattr(self, k, v)
    if affected == 1:
        post_save.send(sender=self.__class__, instance=self, created=False)
        return affected
    elif affected == 0:
        return affected
    elif affected < 0:
        raise ValueError(
            "Somehow we have updated a negative number of rows. You seem to have a problem with your db backend."
        )
    else:
        raise ValueError("Somehow we have updated multiple rows, and you are now royally fucked.")


update.alters_data = True


def create_or_update(model, using=None, **kwargs):
    """
    Similar to get_or_create, either updates a row or creates it.

    In order to determine if the row exists, this searches on all of the kwargs
    besides `values` and `default`.

    If the row exists, it is updated with the data in `values`. If it
    doesn't, it is created with the data in `values`, `defaults`, and the remaining
    kwargs.

    The result will be (rows affected, False) if the row was not created,
    or (instance, True) if the object is new.

    >>> create_or_update(MyModel, key='value', values={
    >>>     'col_name': F('col_name') + 1,
    >>> }, defaults={'created_at': timezone.now()})
    """
    values = kwargs.pop("values", {})
    defaults = kwargs.pop("defaults", {})

    if not using:
        using = router.db_for_write(model)

    objects = model.objects.using(using)

    affected = objects.filter(**kwargs).update(**values)
    if affected:
        return affected, False

    create_kwargs = kwargs.copy()
    inst = objects.model()
    for k, v in itertools.chain(values.items(), defaults.items()):
        # XXX(dcramer): we want to support column shortcut on create so
        # we can do create_or_update(..., {'project': 1})
        if not isinstance(v, Model):
            k = model._meta.get_field(k).attname
        if isinstance(v, CombinedExpression):
            create_kwargs[k] = resolve_combined_expression(inst, v)
        else:
            create_kwargs[k] = v

    try:
        with transaction.atomic(using=using):
            return objects.create(**create_kwargs), True
    except IntegrityError:
        affected = objects.filter(**kwargs).update(**values)

    return affected, False


def in_iexact(column, values):
    """Operator to test if any of the given values are (case-insensitive)
    matching to values in the given column."""
    from operator import or_

    query = f"{column}__iexact"

    return reduce(or_, [Q(**{query: v}) for v in values])


def in_icontains(column, values):
    """Operator to test if any of the given values are (case-insensitively)
    contained within values in the given column."""
    from operator import or_

    query = f"{column}__icontains"

    return reduce(or_, [Q(**{query: v}) for v in values])
