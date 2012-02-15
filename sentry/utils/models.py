"""
sentry.utils.models
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import base64
import logging
import operator

from django.db import models, router
from django.db.models import signals
from django.db.models.expressions import ExpressionNode, F

from sentry.utils.compat import pickle

logger = logging.getLogger(__name__)

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


class Model(models.Model):
    class Meta:
        abstract = True

    def update(self, using=None, **kwargs):
        """
        Updates specified attributes on the current instance.
        """
        assert self.pk, "Cannot update an instance that has not yet been created."

        using = using or router.db_for_write(self.__class__, instance=self)

        for field in self._meta.fields:
            if getattr(field, 'auto_now', False) and field.name not in kwargs:
                kwargs[field.name] = field.pre_save(self, False)

        affected = self.__class__._base_manager.using(using).filter(pk=self.pk).update(**kwargs)
        for k, v in kwargs.iteritems():
            if isinstance(v, ExpressionNode):
                v = resolve_expression_node(self, v)
            setattr(self, k, v)
        if affected == 1:
            signals.post_save.send(sender=self.__class__, instance=self, created=False)
            return True
        elif affected == 0:
            raise self.DoesNotExist("Cannot update an instance that is not in the database.")
        else:
            raise ValueError("Somehow we have updated multiple rows, and you are now royally fucked.")

    update.alters_data = True


class GzippedDictField(models.TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """
    __metaclass__ = models.SubfieldBase

    def to_python(self, value):
        if isinstance(value, basestring) and value:
            try:
                value = pickle.loads(base64.b64decode(value).decode('zlib'))
            except Exception, e:
                logger.exception(e)
                return {}
        elif not value:
            return {}
        return value

    def get_prep_value(self, value):
        if value is None:
            return
        return base64.b64encode(pickle.dumps(value).encode('zlib'))

    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.TextField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)
