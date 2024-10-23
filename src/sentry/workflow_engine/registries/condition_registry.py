import operator
from collections.abc import Callable
from typing import Any

from django.db import models

from sentry.utils.registry import Registry


class DataConditionType(models.TextChoices):
    EQ = "eq", "Equals"
    NE = "ne", "Not Equals"
    GT = "gt", "Greater Than"
    GTE = "gte", "Greater Than or Equals"
    LT = "lt", "Less Than"
    LTE = "lte", "Less Than or Equals"


condition_registry = Registry[Callable[[Any, Any], bool]]()


@condition_registry.register(DataConditionType.EQ)
def eq(a, b) -> bool:
    return operator.eq(a, b)


@condition_registry.register(DataConditionType.NE)
def ne(a, b) -> bool:
    return operator.ne(a, b)


@condition_registry.register(DataConditionType.GT)
def gt(a, b) -> bool:
    return operator.gt(a, b)


@condition_registry.register(DataConditionType.GTE)
def gte(a, b) -> bool:
    return operator.ge(a, b)


@condition_registry.register(DataConditionType.LT)
def lt(a, b) -> bool:
    return operator.lt(a, b)


@condition_registry.register(DataConditionType.LTE)
def lte(a, b) -> bool:
    return operator.le(a, b)
