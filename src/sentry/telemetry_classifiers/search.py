from __future__ import annotations

from functools import partial

from django.db.models import Q, QuerySet
from rest_framework.exceptions import ValidationError

from sentry.api.event_search import SearchConfig, SearchFilter, SearchKey, default_config
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.db.models.query import in_iexact
from sentry.exceptions import InvalidSearchQuery
from sentry.telemetry_classifiers.models import TelemetryClassifier

classifier_search_config = SearchConfig.create_from(
    default_config,
    allowed_keys={"name", "attribute", "status", "dataset"},
    allow_boolean=False,
    free_text_key="query",
)
parse_classifier_query = partial(base_parse_search_query, config=classifier_search_config)


def filter_classifiers_by_query(
    queryset: QuerySet[TelemetryClassifier], raw_query: str
) -> QuerySet[TelemetryClassifier]:
    try:
        parsed_filters = parse_classifier_query(raw_query)
    except InvalidSearchQuery as e:
        raise ValidationError({"query": [str(e)]})

    for search_filter in parsed_filters:
        assert isinstance(search_filter, SearchFilter)
        match search_filter:
            case SearchFilter(key=SearchKey("query"), operator="="):
                text = search_filter.value.value
                queryset = queryset.filter(
                    Q(name__icontains=text) | Q(result_attribute__icontains=text)
                )
            case SearchFilter(key=SearchKey("name"), operator=("=" | "!=" | "IN")):
                queryset = _filter_text(queryset, search_filter, "name")
            case SearchFilter(key=SearchKey("attribute"), operator=("=" | "!=" | "IN")):
                queryset = _filter_text(queryset, search_filter, "result_attribute")
            case SearchFilter(
                key=SearchKey("status" | "dataset" as key),
                operator=("=" | "!=" | "IN" | "NOT IN"),
            ):
                value = search_filter.value.value
                values = value if isinstance(value, list) else [value]
                lookup = {f"{key}__in": values}
                if search_filter.operator in ("!=", "NOT IN"):
                    queryset = queryset.exclude(**lookup)
                else:
                    queryset = queryset.filter(**lookup)
            case _:
                raise ValidationError(
                    {"query": [f"Unsupported filter: {search_filter.to_query_string()}"]}
                )

    return queryset


def _filter_text(
    queryset: QuerySet[TelemetryClassifier], search_filter: SearchFilter, column: str
) -> QuerySet[TelemetryClassifier]:
    if search_filter.operator == "!=":
        return queryset.exclude(**{f"{column}__iexact": search_filter.value.value})
    if search_filter.operator == "IN":
        return queryset.filter(in_iexact(column, search_filter.value.value))

    kind, value = search_filter.value.classify_and_format_wildcard()
    match kind:
        case "infix":
            return queryset.filter(**{f"{column}__icontains": value})
        case "prefix":
            return queryset.filter(**{f"{column}__istartswith": value})
        case "suffix":
            return queryset.filter(**{f"{column}__iendswith": value})
        case _:
            return queryset.filter(**{f"{column}__iexact": search_filter.value.value})
