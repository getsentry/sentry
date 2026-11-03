from django.db.models import F
from django.db.models.expressions import CombinedExpression

__all__ = ("bitand", "bitor")


def bitand(a: F, b: int) -> CombinedExpression:
    return a.bitand(b)


def bitor(a: F, b: int) -> CombinedExpression:
    return a.bitor(b)
