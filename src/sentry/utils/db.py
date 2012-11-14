"""
sentry.utils.db
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import django
import operator

from django.conf import settings as django_settings
from django.db.models.expressions import ExpressionNode, F


def get_db_engine(alias='default'):
    has_multidb = django.VERSION >= (1, 2)
    if has_multidb:
        value = django_settings.DATABASES[alias]['ENGINE']
    else:
        assert alias == 'default', 'You cannot fetch a database engine other than the default on Django < 1.2'
        value = django_settings.DATABASE_ENGINE
    return value.rsplit('.', 1)[-1]


def has_trending(alias='default'):
    # we only support trend queriess for postgres to db optimization
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
    ExpressionNode.AND: operator.and_,
    ExpressionNode.OR: operator.or_,
}


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
