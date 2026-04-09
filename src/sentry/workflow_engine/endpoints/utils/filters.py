from django.db.models import BigIntegerField, Model, Q, QuerySet
from django.db.models.functions import Cast

from sentry.api.event_search import SearchFilter
from sentry.db.models.query import in_iexact
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.subscription_limits import get_disallowed_metric_datasets
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.organization import Organization
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import Detector


def exclude_disallowed_metric_detectors(
    queryset: QuerySet[Detector], organization: Organization
) -> QuerySet[Detector]:
    """
    Exclude metric detectors whose dataset subscription is not allowed
    for the given organization (e.g. after a plan downgrade).
    """
    disallowed_datasets = get_disallowed_metric_datasets(organization)
    if not disallowed_datasets:
        return queryset

    # Cast DataSource.source_id (string) to int so the subquery can use
    # the index on QuerySubscription.id.
    return (
        queryset.annotate(
            _ds_source_int=Cast("data_sources__source_id", output_field=BigIntegerField())
        )
        .exclude(
            type=MetricIssue.slug,
            data_sources__type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            _ds_source_int__in=QuerySubscription.objects.filter(
                snuba_query__dataset__in=disallowed_datasets,
                project__organization=organization,
            ).values_list("id", flat=True),
        )
        .distinct()
    )


def apply_filter[T: Model](
    queryset: QuerySet[T], filter: SearchFilter, column: str, distinct: bool = False
) -> QuerySet[T]:
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
            kind, value_o = filter.value.classify_and_format_wildcard()
            if kind == "infix":
                qs = queryset.filter(Q(**{f"{column}__icontains": value_o}))
            elif kind == "suffix":
                qs = queryset.filter(Q(**{f"{column}__iendswith": value_o}))
            elif kind == "prefix":
                qs = queryset.filter(Q(**{f"{column}__istartswith": value_o}))
            else:
                qs = queryset.filter(**{f"{column}__iexact": filter.value.value})
        case _:
            raise ValueError(f"Invalid operator: {filter.operator}")
    if distinct:
        return qs.distinct()
    return qs
