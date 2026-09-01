from __future__ import annotations

import operator
from functools import reduce
from typing import TYPE_CHECKING, Any

from django.db import router
from django.db.models import F, Model, Q
from django.db.models.expressions import BaseExpression, CombinedExpression, Value
from django.db.models.signals import post_save

if TYPE_CHECKING:
    from sentry.db.models.base import BaseModel

__all__ = ("update",)

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


def _handle_value(instance: BaseModel, value: Any) -> Any:
    if isinstance(value, CombinedExpression):
        return resolve_combined_expression(instance, value)
    return value


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
        post_save.send_robust(
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
