"""
OpenAPI schema for the data sources of a metric monitor.

Each entry is built from the constants that `SnubaQueryValidator` validates against, so that API
clients can read the accepted `aggregate` values from the schema instead of copying them.

Scope: the detector endpoints use one request schema for every detector type, but the public API
only documents `metric_issue` monitors, so only metric data sources are described here. Cron and
uptime detectors still send their own data sources, and their validators accept them, but the
schema doesn't describe them. Adding a catch-all branch for them would make the `oneOf` match
any object, so clients could no longer use it to check aggregates.

The aggregate lists document what metric monitors support, which is narrower than what the
validator lets through:

- Errors: the validator accepts any Discover function whose column is empty or allowlisted, as
  long as a test query runs. The schema lists `count()` and `count_unique()` over the
  allowlisted columns. The monitor UI offers `count()` and `count_unique(user)`.
- Spans: `get_column_from_aggregate` also lets through Insights functions such as
  `http_response_rate`, `cache_miss_rate`, and `count_scores`. That shortcut dates from 2024
  alerts on the span metrics dataset. Since 2025, Insights creates monitors with comparable
  `count()` queries instead, because Explore and alerts don't support these functions.

`EAP_MONITOR_FUNCTIONS` is also written to
`static/app/views/detectors/monitorAggregates.generated.json` by
`python3 -m tools.monitor_aggregates_to_json`, so the monitor form can't offer a function
that the backend rejects.
"""

import re
from collections.abc import Iterable
from typing import Any

from sentry.incidents.logic import EAP_FUNCTIONS, TRANSLATABLE_COLUMNS
from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import CRASH_RATE_ALERT_AGGREGATE_RE
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType


def _defined_functions(definitions: ColumnDefinitions) -> set[str]:
    return set(definitions.aggregates) | set(definitions.formulas)


def _alertable_eap_functions(definitions: ColumnDefinitions) -> list[str]:
    defined = _defined_functions(definitions)
    return [function for function in EAP_FUNCTIONS if function in defined]


def _function_call_pattern(functions: Iterable[str], allow_equations: bool = False) -> str:
    call = r"(?:{})\(.*\)".format("|".join(re.escape(function) for function in functions))
    if allow_equations:
        return rf"^(?:{call}|equation\|.+)$"
    return rf"^{call}$"


ERRORS_AGGREGATES = [
    "count()",
    *(f"count_unique({column})" for column in TRANSLATABLE_COLUMNS),
    *(f"count_unique({column})" for column in TRANSLATABLE_COLUMNS.values()),
]
# Keyed by the frontend's DetectorDataset values.
EAP_MONITOR_FUNCTIONS = {
    "spans": _alertable_eap_functions(SPAN_DEFINITIONS),
    "logs": _alertable_eap_functions(OURLOG_DEFINITIONS),
}
_SPANS_AGGREGATE_PATTERN = _function_call_pattern(EAP_MONITOR_FUNCTIONS["spans"])
_LOGS_AGGREGATE_PATTERN = _function_call_pattern(EAP_MONITOR_FUNCTIONS["logs"])
_TRACE_METRICS_AGGREGATE_PATTERN = _function_call_pattern(
    sorted(_defined_functions(TRACE_METRICS_DEFINITIONS)), allow_equations=True
)


def _data_source_schema(
    *,
    title: str,
    description: str,
    query_type: SnubaQuery.Type,
    dataset: Dataset,
    event_types: list[SnubaQueryEventType.EventType] | None,
    aggregate: dict[str, Any],
) -> dict[str, Any]:
    if event_types is None:
        event_types_schema: dict[str, Any] = {
            "type": "array",
            "items": {"type": "string"},
            "description": "Ignored for this dataset. Send an empty list.",
        }
    else:
        event_types_schema = {
            "type": "array",
            "items": {
                "type": "string",
                "enum": [event_type.name.lower() for event_type in event_types],
            },
            "minItems": 1,
            "maxItems": len(event_types),
        }

    return {
        "type": "object",
        "title": title,
        "description": description,
        "properties": {
            "query_type": {"type": "integer", "enum": [query_type.value]},
            "dataset": {"type": "string", "enum": [dataset.value]},
            "query": {
                "type": "string",
                "description": "A search query to filter the events, such as `is:unresolved`.",
            },
            "aggregate": aggregate,
            "time_window": {
                "type": "integer",
                "description": "The time window to aggregate over, in seconds.",
            },
            "environment": {"type": "string", "nullable": True},
            "event_types": event_types_schema,
            "extrapolation_mode": {"type": "string", "nullable": True},
        },
        "required": ["dataset", "query", "aggregate", "time_window", "environment", "event_types"],
    }


METRIC_DATA_SOURCE_SCHEMA: dict[str, Any] = {
    "oneOf": [
        _data_source_schema(
            title="Errors",
            description="Counts error events or the users they affect.",
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            event_types=[
                SnubaQueryEventType.EventType.ERROR,
                SnubaQueryEventType.EventType.DEFAULT,
            ],
            aggregate={"type": "string", "enum": ERRORS_AGGREGATES},
        ),
        _data_source_schema(
            title="Spans",
            description=(
                "Aggregates span attributes, such as `p95(span.duration)`. "
                "To query transaction spans, add `is_transaction:true` to `query`."
            ),
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.EventsAnalyticsPlatform,
            event_types=[SnubaQueryEventType.EventType.TRACE_ITEM_SPAN],
            aggregate={"type": "string", "pattern": _SPANS_AGGREGATE_PATTERN},
        ),
        _data_source_schema(
            title="Logs",
            description="Aggregates log attributes, such as `count(message)`.",
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.EventsAnalyticsPlatform,
            event_types=[SnubaQueryEventType.EventType.TRACE_ITEM_LOG],
            aggregate={"type": "string", "pattern": _LOGS_AGGREGATE_PATTERN},
        ),
        _data_source_schema(
            title="Application Metrics",
            description=(
                "Aggregates an application metric. The function arguments name the metric, "
                "its type, and its unit, such as `per_second(value,metric_name,counter,-)`. "
                "An `equation|` prefix combines several aggregates."
            ),
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.EventsAnalyticsPlatform,
            event_types=[SnubaQueryEventType.EventType.TRACE_ITEM_METRIC],
            aggregate={"type": "string", "pattern": _TRACE_METRICS_AGGREGATE_PATTERN},
        ),
        _data_source_schema(
            title="Crash Rate",
            description=(
                "Measures the percentage of crashed sessions or users, such as "
                "`percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate`."
            ),
            query_type=SnubaQuery.Type.CRASH_RATE,
            dataset=Dataset.Metrics,
            event_types=None,
            aggregate={"type": "string", "pattern": CRASH_RATE_ALERT_AGGREGATE_RE},
        ),
    ]
}
