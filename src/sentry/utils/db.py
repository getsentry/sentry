"""
sentry.utils.db
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import django
import logging
import operator


from django.conf import settings as django_settings
from django.db.models.expressions import ExpressionNode, F


class InstanceManager(object):
    def __init__(self, class_list=None, instances=True):
        if class_list is None:
            class_list = []
        self.instances = instances
        self.update(class_list)

    def get_class_list(self):
        return self.class_list

    def add(self, class_path):
        self.cache = None
        self.class_list.append(class_path)

    def remove(self, class_path):
        self.cache = None
        self.class_list.remove(class_path)

    def update(self, class_list):
        """
        Updates the class list and wipes the cache.
        """
        self.cache = None
        self.class_list = class_list

    def all(self):
        """
        Returns a list of cached instances.
        """
        class_list = list(self.get_class_list())
        if not class_list:
            self.cache = []
            return []

        if self.cache is not None:
            return self.cache

        results = []
        for cls_path in class_list:
            module_name, class_name = cls_path.rsplit('.', 1)
            try:
                module = __import__(module_name, {}, {}, class_name)
                cls = getattr(module, class_name)
                if self.instances:
                    results.append(cls())
                else:
                    results.append(cls)
            except Exception:
                logger = logging.getLogger('sentry.errors')
                logger.exception('Unable to import %s', cls_path)
                continue
        self.cache = results

        return results


def get_db_engine(alias='default'):
    has_multidb = django.VERSION >= (1, 2)
    if has_multidb:
        value = django_settings.DATABASES[alias]['ENGINE']
    else:
        assert alias == 'default', 'You cannot fetch a database engine other than the default on Django < 1.2'
        value = django_settings.DATABASE_ENGINE
    return value.rsplit('.', 1)[-1]


def has_trending(alias='default'):
    return get_db_engine('default').startswith(('mysql', 'postgres'))


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
