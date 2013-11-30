"""
sentry.db.utils
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import operator

from uuid import uuid4

from django.db.models import F
from django.db.models.expressions import ExpressionNode
from django.template.defaultfilters import slugify

from sentry.db.exceptions import CannotResolveExpression


EXPRESSION_NODE_CALLBACKS = {
    ExpressionNode.ADD: operator.add,
    ExpressionNode.SUB: operator.sub,
    ExpressionNode.MUL: operator.mul,
    ExpressionNode.DIV: operator.div,
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
        if isinstance(node, F):
            return getattr(instance, node.name)
        elif isinstance(node, ExpressionNode):
            return resolve_expression_node(instance, node)
        return node

    op = EXPRESSION_NODE_CALLBACKS.get(node.connector, None)
    if not op:
        raise CannotResolveExpression
    runner = _resolve(instance, node.children[0])
    for n in node.children[1:]:
        runner = op(runner, _resolve(instance, n))
    return runner


def slugify_instance(inst, label, reserved=(), **kwargs):
    base_slug = slugify(label)
    if base_slug in reserved:
        base_slug = None
    if not base_slug:
        base_slug = uuid4().hex[:12]
    manager = type(inst).objects
    inst.slug = base_slug
    n = 0
    while manager.filter(slug__iexact=inst.slug, **kwargs).exists():
        n += 1
        inst.slug = base_slug + '-' + str(n)
