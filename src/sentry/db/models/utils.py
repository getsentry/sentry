"""
sentry.db.utils
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import operator

from django.db.models import F
from django.utils.crypto import get_random_string
from django.template.defaultfilters import slugify
from uuid import uuid4

from sentry.db.exceptions import CannotResolveExpression


class _UnknownType(object):
    pass

try:
    from django.db.models.expressions import ExpressionNode
    Value = _UnknownType
except ImportError:
    from django.db.models.expressions import Combinable as ExpressionNode, Value


EXPRESSION_NODE_CALLBACKS = {
    ExpressionNode.ADD: operator.add,
    ExpressionNode.SUB: operator.sub,
    ExpressionNode.MUL: operator.mul,
    ExpressionNode.DIV: getattr(operator, 'floordiv', None) or operator.div,
    ExpressionNode.MOD: operator.mod,
}
try:
    EXPRESSION_NODE_CALLBACKS[ExpressionNode.AND] = operator.and_
except AttributeError:
    EXPRESSION_NODE_CALLBACKS[ExpressionNode.BITAND] = operator.and_
try:
    EXPRESSION_NODE_CALLBACKS[ExpressionNode.OR] = operator.or_
except AttributeError:
    EXPRESSION_NODE_CALLBACKS[ExpressionNode.BITOR] = operator.or_


def resolve_expression_node(instance, node):
    def _resolve(instance, node):
        if isinstance(node, Value):
            return node.value
        if isinstance(node, F):
            return getattr(instance, node.name)
        if isinstance(node, ExpressionNode):
            return resolve_expression_node(instance, node)
        return node

    if isinstance(node, Value):
        return node.value
    if not hasattr(node, 'connector'):
        raise CannotResolveExpression
    op = EXPRESSION_NODE_CALLBACKS.get(node.connector, None)
    if not op:
        raise CannotResolveExpression
    if hasattr(node, 'children'):
        children = node.children
    else:
        children = [node.lhs, node.rhs]
    runner = _resolve(instance, children[0])
    for n in children[1:]:
        runner = op(runner, _resolve(instance, n))
    return runner


def slugify_instance(inst, label, reserved=(), max_length=30, field_name='slug', *args, **kwargs):
    base_value = slugify(label)[:max_length]

    if base_value is not None:
        base_value = base_value.strip()
        if base_value in reserved:
            base_value = None

    if not base_value:
        base_value = uuid4().hex[:12]

    base_qs = type(inst).objects.all()
    if inst.id:
        base_qs = base_qs.exclude(id=inst.id)
    if args or kwargs:
        base_qs = base_qs.filter(*args, **kwargs)

    setattr(inst, field_name, base_value)

    # We don't need to further mutate if we're unique at this point
    if not base_qs.filter(**{
        '{}__iexact'.format(field_name): base_value,
    }).exists():
        return

    # We want to sanely generate the shortest unique slug possible, so
    # we try different length endings until we get one that works, or bail.

    # At most, we have 27 attempts here to derive a unique slug
    sizes = (
        (1, 2),  # (36^2) possibilities, 2 attempts
        (5, 3),  # (36^3) possibilities, 3 attempts
        (20, 5),  # (36^5) possibilities, 20 attempts
        (1, 12),  # (36^12) possibilities, 1 final attempt
    )
    for attempts, size in sizes:
        for i in range(attempts):
            end = get_random_string(size, allowed_chars='abcdefghijklmnopqrstuvwxyz0123456790')
            value = base_value[:max_length - size - 1] + '-' + end
            setattr(inst, field_name, value)
            if not base_qs.filter(**{
                '{}__iexact'.format(field_name): value,
            }).exists():
                return

    # If at this point, we've exhausted all possibilities, we'll just end up hitting
    # an IntegrityError from database, which is ok, and unlikely to happen
