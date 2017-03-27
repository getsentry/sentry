from __future__ import absolute_import

__all__ = ('bitand', 'bitor')


def bitand(a, b):
    return a.bitand(b)


def bitor(a, b):
    return a.bitor(b)


try:
    from django.db.models.expressions import ExpressionNode
    ExpressionNode.BITAND  # noqa
    del ExpressionNode
except ImportError:
    # Django >= 1.8
    pass
except AttributeError:
    # Django < 1.5
    def bitand(a, b):  # NOQA
        return a & b

    def bitor(a, b):  # NOQA
        return a | b
