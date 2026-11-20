"""Scope, transport and value normalization shared by the anomaly detection inputs."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue, StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    TraceItemFilter,
)
from snuba_sdk import Column, Condition, Function, Op, Query, Request

from sentry.search.eap.rpc_utils import and_trace_item_filters, or_trace_item_filters
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaRow
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_snql_query

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.search.eap.resolver import SearchResolver


def project_map(organization: Organization, projects: Sequence[Project]) -> dict[int, Project]:
    if any(project.organization_id != organization.id for project in projects):
        raise ValueError("Anomaly detection projects must belong to the organization")
    return {project.id: project for project in projects}


def utc(value: datetime | str | int) -> datetime:
    """Normalize to naive UTC, the timestamp form used throughout anomaly detection."""
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    elif isinstance(value, int):
        value = datetime.fromtimestamp(value, timezone.utc)
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


def number(value: object) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return float(value)
    return None


# Environment comes back nullable in the errors dataset. Use one expression for
# grouping and filtering so null and empty environment mean the same thing.
def error_env(alias: str | None = None) -> Function:
    return Function("coalesce", [Column("environment"), ""], alias)


def error_where(project: Project, start: datetime, end: datetime) -> list[Condition]:
    return [
        Condition(Column("project_id"), Op.EQ, project.id),
        Condition(Column("timestamp"), Op.GTE, start.replace(tzinfo=timezone.utc)),
        Condition(Column("timestamp"), Op.LT, end.replace(tzinfo=timezone.utc)),
    ]


def run_errors(organization: Organization, query: Query, referrer: str) -> list[SnubaRow]:
    response = raw_snql_query(
        Request(
            dataset=Dataset.Events.value,
            app_id="errors",
            query=query,
            tenant_ids={"organization_id": organization.id},
        ),
        referrer=referrer,
    )
    return response["data"]


def span_attribute_filter(
    resolver: SearchResolver, field: str, values: tuple[str, ...]
) -> TraceItemFilter | None:
    """Match any of the values; "" matches a missing or empty attribute."""
    attribute, _ = resolver.resolve_attribute(field)
    key = attribute.proto_definition
    nonempty = [value for value in values if value]
    filters: list[TraceItemFilter] = []
    if nonempty:
        filters.append(
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=key,
                    op=ComparisonFilter.OP_IN,
                    value=AttributeValue(val_str_array=StrArray(values=nonempty)),
                )
            )
        )
    if "" in values:
        filters.extend(
            (
                TraceItemFilter(
                    not_filter=NotFilter(
                        filters=[TraceItemFilter(exists_filter=ExistsFilter(key=key))]
                    )
                ),
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=key, op=ComparisonFilter.OP_EQUALS, value=AttributeValue(val_str="")
                    )
                ),
            )
        )
    return or_trace_item_filters(*filters)


@dataclass(frozen=True, kw_only=True)
class ScopedSpans(SearchResolverConfig):
    """Spans resolver config with structured filters, so values are never parsed as search syntax."""

    filters: tuple[tuple[str, tuple[str, ...]], ...] = ()
    named_dimension: str = ""
    stable_timestamp_quantization: bool = False
    zerofill_timeseries: bool = False

    def extra_conditions(
        self,
        search_resolver: SearchResolver,
        selected_columns: list[str] | None,
        equations: list[str] | None,
    ) -> TraceItemFilter | None:
        filters = [
            span_attribute_filter(search_resolver, field, values) for field, values in self.filters
        ]
        if self.named_dimension:
            attribute, _ = search_resolver.resolve_attribute(self.named_dimension)
            key = attribute.proto_definition
            filters.extend(
                [
                    TraceItemFilter(exists_filter=ExistsFilter(key=key)),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=key,
                            op=ComparisonFilter.OP_NOT_EQUALS,
                            value=AttributeValue(val_str=""),
                        )
                    ),
                ]
            )
        return and_trace_item_filters(*filters)
