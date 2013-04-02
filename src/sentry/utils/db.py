"""
sentry.utils.db
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import django
import operator

from django.conf import settings as django_settings
from django.db.models.expressions import ExpressionNode, F
from django.db.models.fields.related import SingleRelatedObjectDescriptor


def get_db_engine(alias='default'):
    has_multidb = django.VERSION >= (1, 2)
    if has_multidb:
        value = django_settings.DATABASES[alias]['ENGINE']
    else:
        assert alias == 'default', 'You cannot fetch a database engine other than the default on Django < 1.2'
        value = django_settings.DATABASE_ENGINE
    return value.rsplit('.', 1)[-1]


def has_trending(alias='default'):
    # we only support trend queries for postgres to db optimization
    # issues in mysql, and lack of anything useful in sqlite
    return get_db_engine('default').startswith('postgres')


def has_charts(db):
    engine = get_db_engine(db)
    if engine.startswith('sqlite'):
        return False
    return True

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


class CannotResolve(Exception):
    pass


def resolve_expression_node(instance, node):
    def _resolve(instance, node):
        if isinstance(node, F):
            return getattr(instance, node.name)
        elif isinstance(node, ExpressionNode):
            return resolve_expression_node(instance, node)
        return node

    op = EXPRESSION_NODE_CALLBACKS.get(node.connector, None)
    if not op:
        raise CannotResolve
    runner = _resolve(instance, node.children[0])
    for n in node.children[1:]:
        runner = op(runner, _resolve(instance, n))
    return runner


def attach_foreignkey(objects, field, related=[], database=None):
    """
    Shortcut method which handles a pythonic LEFT OUTER JOIN.

    ``attach_foreignkey(posts, Post.thread)``

    Works with both ForeignKey and OneToOne (reverse) lookups.
    """

    if not objects:
        return

    if database is None:
        database = list(objects)[0]._state.db

    is_foreignkey = isinstance(field, SingleRelatedObjectDescriptor)

    if not is_foreignkey:
        field = field.field
        accessor = '_%s_cache' % field.name
        model = field.rel.to
        lookup = 'pk'
        column = field.column
        key = lookup
    else:
        accessor = field.cache_name
        field = field.related.field
        model = field.model
        lookup = field.name
        column = 'pk'
        key = field.column

    objects = [o for o in objects if (related or getattr(o, accessor, False) is False)]

    if not objects:
        return

    # Ensure values are unique, do not contain already present values, and are not missing
    # values specified in select_related
    values = set(filter(None, (getattr(o, column) for o in objects)))
    if values:
        qs = model.objects.filter(**{'%s__in' % lookup: values})
        if database:
            qs = qs.using(database)
        if related:
            qs = qs.select_related(*related)

        queryset = dict((getattr(o, key), o) for o in qs)
    else:
        queryset = {}

    for o in objects:
        setattr(o, accessor, queryset.get(getattr(o, column)))
