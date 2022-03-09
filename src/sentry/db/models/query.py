from __future__ import annotations

import itertools
from functools import reduce
from typing import Any, Tuple, Type, cast

from django.db import IntegrityError, router, transaction
from django.db.models import Model, Q
from django.db.models.expressions import CombinedExpression
from django.db.models.signals import post_save

from .utils import resolve_combined_expression

__all__ = ("update", "create_or_update")


def update(instance: Model, using: str | None = None, **kwargs: Any) -> int:
    """
    Updates specified attributes on the current instance.
    """
    assert instance.pk, "Cannot update an instance that has not yet been created."

    using = using or router.db_for_write(instance.__class__, instance=instance)

    for field in instance._meta.fields:
        if getattr(field, "auto_now", False) and field.name not in kwargs:
            kwargs[field.name] = field.pre_save(instance, False)

    affected = cast(
        int, instance.__class__._base_manager.using(using).filter(pk=instance.pk).update(**kwargs)
    )
    for k, v in kwargs.items():
        if isinstance(v, CombinedExpression):
            v = resolve_combined_expression(instance, v)
        setattr(instance, k, v)
    if affected == 1:
        post_save.send(sender=instance.__class__, instance=instance, created=False)
        return affected
    elif affected == 0:
        return affected
    elif affected < 0:
        raise ValueError(
            "Somehow we have updated a negative number of rows. You seem to have a problem with your db backend."
        )
    else:
        raise ValueError("Somehow we have updated multiple rows. This is very, very bad.")


update.alters_data = True  # type: ignore


def create_or_update(
    model: Type[Model], using: str | None = None, **kwargs: Any
) -> Tuple[int, bool]:
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


def in_iexact(column: str, values: Any) -> Q:
    """Operator to test if any of the given values are (case-insensitive)
    matching to values in the given column."""
    from operator import or_

    query = f"{column}__iexact"

    return reduce(or_, [Q(**{query: v}) for v in values])


def in_icontains(column: str, values: Any) -> Q:
    """Operator to test if any of the given values are (case-insensitively)
    contained within values in the given column."""
    from operator import or_

    query = f"{column}__icontains"

    return reduce(or_, [Q(**{query: v}) for v in values])
