from __future__ import annotations

import itertools
from functools import reduce
from typing import Any, Tuple, Type, cast

from django.db import IntegrityError, router, transaction
from django.db.models import Model, Q
from django.db.models.expressions import CombinedExpression
from django.db.models.signals import post_save

from .utils import resolve_combined_expression

__all__ = (
    "create_or_update",
    "update",
    "update_or_create",
)


def _handle_value(instance: Model, value: Any) -> Any:
    if isinstance(value, CombinedExpression):
        return resolve_combined_expression(instance, value)
    return value


def _handle_key(model: Type[Model], key: str, value: Any) -> str:
    # XXX(dcramer): we want to support column shortcut on create so we can do
    #  create_or_update(..., {'project': 1})
    if not isinstance(value, Model):
        key_: str = model._meta.get_field(key).attname
        return key_
    return key


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
        setattr(instance, k, _handle_value(instance, v))
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


def update_or_create(
    model: Type[Model],
    using: str | None = None,
    **kwargs: Any,
) -> tuple[Model, bool]:
    """
    Similar to `get_or_create()`, either updates a row or creates it.

    In order to determine if the row exists, this searches on all of the kwargs
    besides `defaults`. If the row exists, it is updated with the data in
    `defaults`. If it doesn't, it is created with the data in `defaults` and the
    remaining kwargs.

    Returns a tuple of (object, created), where object is the created or updated
    object and created is a boolean specifying whether a new object was created.
    """

    defaults = kwargs.pop("defaults", {})

    if not using:
        using = router.db_for_write(model)

    objects = model.objects.using(using)

    affected = objects.filter(**kwargs).update(**defaults)
    if affected:
        return affected, False

    instance = objects.model()

    create_kwargs = kwargs.copy()
    create_kwargs.update(
        {_handle_key(model, k, v): _handle_value(instance, v) for k, v in defaults.items()}
    )

    try:
        with transaction.atomic(using=using):
            return objects.create(**create_kwargs), True
    except IntegrityError:
        pass

    # Retrying the update() here to preserve behavior in a race condition with a concurrent create().
    return objects.filter(**kwargs).update(**defaults), False


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
    # if values is empty, have a default value for the reduce call that will essentially resolve a column in []
    query_in = f"{column}__in"

    return reduce(or_, [Q(**{query: v}) for v in values], Q(**{query_in: []}))


def in_icontains(column: str, values: Any) -> Q:
    """Operator to test if any of the given values are (case-insensitively)
    contained within values in the given column."""
    from operator import or_

    query = f"{column}__icontains"

    return reduce(or_, [Q(**{query: v}) for v in values])
