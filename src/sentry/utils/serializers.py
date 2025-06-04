from collections import defaultdict
from collections.abc import Callable, MutableMapping
from typing import Any, TypeVar

from django.db.models import Model, QuerySet

T = TypeVar("T", bound=Model)


def manytoone_to_dict(
    queryset: QuerySet[T], key: str, filter_func: Callable[[Any], bool] | None = None
) -> MutableMapping[Any, list[T]]:
    result = defaultdict(list)
    for row in queryset:
        if filter_func and not filter_func(row):
            continue
        result[getattr(row, key)].append(row)
    return result
