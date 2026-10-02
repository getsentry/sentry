from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import BigIntegerField, Exists, Model, OuterRef, Q, QuerySet
from django.db.models.functions import Cast

from sentry import features
from sentry.api.event_search import SearchFilter
from sentry.db.models.query import in_iexact
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.subscription_limits import get_disallowed_metric_datasets
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.organization import Organization
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import APIGate, DetectorAPIOperation

if TYPE_CHECKING:
    from django.contrib.auth.models import AnonymousUser

    from sentry.users.models.user import User
    from sentry.users.services.user.model import RpcUser


def _api_gate_enabled(
    gate: APIGate,
    organization: Organization,
    actor: User | RpcUser | AnonymousUser | None,
) -> bool:
    if isinstance(gate, bool):
        return gate
    return features.has(gate.name, organization, actor=actor)


def get_excluded_detector_types(
    operation: DetectorAPIOperation | str | None,
    organization: Organization,
    *,
    actor: User | RpcUser | AnonymousUser | None = None,
) -> list[str]:
    """Resolve detector-platform API gates for the current request, without fetching rows."""
    if operation == "HEAD":
        operation = DetectorAPIOperation.GET

    required_operations: tuple[DetectorAPIOperation, ...]
    if operation is None:
        required_operations = ()
    else:
        try:
            operation = DetectorAPIOperation(operation)
        except ValueError:
            # Leave unsupported verbs to endpoint dispatch; only the global gate applies.
            required_operations = ()
        else:
            required_operations = (
                (DetectorAPIOperation.GET, DetectorAPIOperation.LIST)
                if operation == DetectorAPIOperation.LIST
                else (operation,)
            )

    return [
        detector_type
        for detector_type, settings in detector_settings_registry.registrations.items()
        if not _api_gate_enabled(settings.api_enabled, organization, actor)
        or not all(
            _api_gate_enabled(
                settings.api_availability.get(required_operation, True), organization, actor
            )
            for required_operation in required_operations
        )
    ]


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

    # Correlated EXISTS subquery that short-circuits on first match per detector.
    disallowed_ds = (
        DataSourceDetector.objects.filter(
            detector_id=OuterRef("pk"),
            data_source__type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        # Cast DataSource.source_id (string) to int for type-compatible
        # comparison against QuerySubscription.id in the IN clause.
        .annotate(
            _source_int=Cast("data_source__source_id", output_field=BigIntegerField()),
        )
        .filter(
            _source_int__in=QuerySubscription.objects.filter(
                snuba_query__dataset__in=disallowed_datasets,
                project__organization=organization,
            ).values("id"),
        )
    )

    return queryset.exclude(Q(type=MetricIssue.slug) & Exists(disallowed_ds))


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
