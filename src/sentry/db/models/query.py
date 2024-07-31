from __future__ import annotations

import itertools
import operator
from functools import reduce
from typing import TYPE_CHECKING, Any, Literal

from django.db import IntegrityError, router, transaction
from django.db.models import F, Model, Q
from django.db.models.expressions import BaseExpression, CombinedExpression, Value
from django.db.models.fields import Field
from django.db.models.signals import post_save

if TYPE_CHECKING:
    from sentry.db.models.base import BaseModel

__all__ = (
    "create_or_update",
    "update",
    "update_or_create",
)

COMBINED_EXPRESSION_CALLBACKS = {
    CombinedExpression.ADD: operator.add,
    CombinedExpression.SUB: operator.sub,
    CombinedExpression.MUL: operator.mul,
    CombinedExpression.DIV: operator.floordiv,
    CombinedExpression.MOD: operator.mod,
    CombinedExpression.BITAND: operator.and_,
    CombinedExpression.BITOR: operator.or_,
}


class CannotResolveExpression(Exception):
    pass


def resolve_combined_expression(instance: Model, node: CombinedExpression) -> BaseExpression:
    def _resolve(instance: Model, node: BaseExpression | F) -> BaseExpression:
        if isinstance(node, Value):
            return node.value
        if isinstance(node, F):
            return getattr(instance, node.name)
        if isinstance(node, CombinedExpression):
            return resolve_combined_expression(instance, node)
        return node

    if isinstance(node, Value):
        return node.value
    if not isinstance(node, CombinedExpression):
        raise CannotResolveExpression
    op = COMBINED_EXPRESSION_CALLBACKS.get(node.connector, None)
    if not op:
        raise CannotResolveExpression
    if hasattr(node, "children"):
        children = node.children
    else:
        children = [node.lhs, node.rhs]
    runner = _resolve(instance, children[0])
    for n in children[1:]:
        runner = op(runner, _resolve(instance, n))
    return runner


def _get_field(model: type[Model], key: str) -> Field[object, object]:
    field = model._meta.get_field(key)
    if not isinstance(field, Field):
        raise TypeError(f"expected Field for {key}, got ({field})")
    return field


def _handle_value(instance: BaseModel, value: Any) -> Any:
    if isinstance(value, CombinedExpression):
        return resolve_combined_expression(instance, value)
    return value


def _handle_key(model: type[BaseModel], key: str, value: Any) -> str:
    # XXX(dcramer): we want to support column shortcut on create so we can do
    #  create_or_update(..., {'project': 1})
    if not isinstance(value, Model):
        return _get_field(model, key).attname
    return key


def update(instance: BaseModel, using: str | None = None, **kwargs: Any) -> int:
    """
    Updates specified attributes on the current instance.
    """
    assert instance.pk, "Cannot update an instance that has not yet been created."

    using = using or router.db_for_write(instance.__class__, instance=instance)

    for field in instance._meta.fields:
        if getattr(field, "auto_now", False) and field.name not in kwargs:
            kwargs[field.name] = field.pre_save(instance, False)

    affected = (
        instance.__class__.objects.using(using)
        .filter(pk=instance.pk)
        # Disable the post update query signal since we're going to send a more specific `post_save` signal here.
        .with_post_update_signal(False)
        .update(**kwargs)
    )
    for k, v in kwargs.items():
        setattr(instance, k, _handle_value(instance, v))
    if affected == 1:
        post_save.send(
            sender=instance.__class__,
            instance=instance,
            created=False,
            update_fields=list(kwargs.keys()),
        )
        return affected
    elif affected == 0:
        return affected
    elif affected < 0:
        raise ValueError(
            "Somehow we have updated a negative number of rows. You seem to have a problem with your db backend."
        )
    else:
        raise ValueError("Somehow we have updated multiple rows. This is very, very bad.")


update.alters_data = True  # type: ignore[attr-defined]


def update_or_create(
    model: type[BaseModel],
    using: str | None = None,
    **kwargs: Any,
) -> tuple[int, Literal[False]] | tuple[BaseModel, Literal[True]]:
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
    model: type[Model], using: str | None = None, **kwargs: Any
) -> tuple[int, Literal[False]] | tuple[Model, Literal[True]]:
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
            k = _get_field(model, k).attname
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
