from django.db.models import Model, QuerySet

from sentry.api.event_search import SearchFilter
from sentry.db.models.query import in_iexact


def apply_filter[
    T: Model
](queryset: QuerySet[T], filter: SearchFilter, column: str, distinct: bool = False) -> QuerySet[T]:
    """
    Apply a search filter to a Django queryset with case-insensitive matching.

    Supports operators: "=" (exact), "!=" (exclude), "IN" (containment).
    """
    match filter.operator:
        case "!=":
            qs = queryset.exclude(**{f"{column}__iexact": filter.value.value})
        case "IN":
            qs = queryset.filter(in_iexact(column, filter.value.value))
        case "=":
            qs = queryset.filter(**{f"{column}__iexact": filter.value.value})
        case _:
            raise ValueError(f"Invalid operator: {filter.operator}")
    if distinct:
        return qs.distinct()
    return qs
