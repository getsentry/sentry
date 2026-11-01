import re
from pathlib import Path
from typing import Any

import jsonschema
import pytest

from sentry.api.serializers.rest_framework.base import camel_to_snake_case, convert_dict_key_case
from sentry.incidents.logic import check_aggregate_column_support
from sentry.utils import json
from sentry.workflow_engine.endpoints.validators.api_docs_help_text import DATA_SOURCES_HELP_TEXT
from sentry.workflow_engine.endpoints.validators.metric_data_source_schema import (
    ERRORS_AGGREGATES,
    METRIC_DATA_SOURCE_SCHEMA,
)


def _matching_titles(data_source: dict[str, Any]) -> list[str]:
    return [
        branch["title"]
        for branch in METRIC_DATA_SOURCE_SCHEMA["oneOf"]
        if jsonschema.Draft7Validator(branch).is_valid(data_source)
    ]


def _data_source(dataset: str, event_types: list[str], aggregate: str) -> dict[str, Any]:
    return {
        "dataset": dataset,
        "query": "",
        "aggregate": aggregate,
        "time_window": 3600,
        "environment": "prod",
        "event_types": event_types,
    }


def _help_text_examples() -> list[dict[str, Any]]:
    blocks = re.findall(r"```json(.*?)```", DATA_SOURCES_HELP_TEXT, re.DOTALL)
    return [
        convert_dict_key_case(data_source, camel_to_snake_case)
        for block in blocks
        for data_source in json.loads(block)
    ]


@pytest.mark.parametrize("example", _help_text_examples(), ids=lambda example: example["aggregate"])
def test_help_text_examples_match_one_data_source(example: dict[str, Any]) -> None:
    assert len(_matching_titles(example)) == 1


@pytest.mark.parametrize("aggregate", ERRORS_AGGREGATES)
def test_errors_aggregates_pass_column_support_check(aggregate: str) -> None:
    assert check_aggregate_column_support(aggregate)


@pytest.mark.parametrize(
    ("data_source", "title"),
    [
        (_data_source("events", ["error"], "count_unique(user)"), "Errors"),
        (_data_source("events_analytics_platform", ["trace_item_span"], "count()"), "Spans"),
        (
            _data_source("events_analytics_platform", ["trace_item_span"], "p100(span.duration)"),
            "Spans",
        ),
        (
            _data_source(
                "events_analytics_platform",
                ["trace_item_span"],
                "opportunity_score(measurements.score.lcp)",
            ),
            "Spans",
        ),
        (_data_source("events_analytics_platform", ["trace_item_log"], "count(message)"), "Logs"),
        (
            _data_source(
                "events_analytics_platform",
                ["trace_item_metric"],
                "per_second(value,metric_name_one,counter,-)",
            ),
            "Application Metrics",
        ),
        (
            _data_source(
                "events_analytics_platform",
                ["trace_item_metric"],
                "equation|sum(value,a,counter,none) / sum(value,b,counter,none)",
            ),
            "Application Metrics",
        ),
        (
            _data_source(
                "metrics",
                [],
                "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            ),
            "Crash Rate",
        ),
        (
            _data_source(
                "metrics", [], "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
            ),
            "Crash Rate",
        ),
    ],
)
def test_accepted_aggregates(data_source: dict[str, Any], title: str) -> None:
    assert _matching_titles(data_source) == [title]


@pytest.mark.parametrize(
    "data_source",
    [
        _data_source("events", ["error"], "p95(transaction.duration)"),
        _data_source(
            "events_analytics_platform", ["trace_item_span"], "percentile(measurements.lcp,0.95)"
        ),
        _data_source("events_analytics_platform", ["trace_item_span"], "http_response_rate(5)"),
        _data_source(
            "events_analytics_platform",
            ["trace_item_log"],
            "performance_score(measurements.score.lcp)",
        ),
        _data_source("events_analytics_platform", ["trace_item_log"], "p100(severity)"),
        _data_source("events_analytics_platform", ["trace_item_log"], "failure_rate()"),
        _data_source("metrics", [], "count()"),
    ],
)
def test_rejected_aggregates(data_source: dict[str, Any]) -> None:
    assert _matching_titles(data_source) == []


_REPO_ROOT = Path(__file__).parents[5]
_FIELDS_TS = _REPO_ROOT / "static/app/utils/fields/index.ts"
_MONITOR_VISUALIZE_TSX = (
    _REPO_ROOT / "static/app/views/detectors/components/forms/metric/visualize.tsx"
)

# The logs monitor UI offers these, but the logs definitions don't define them, so building the
# subscription request fails with "Unknown function". Remove entries as the UI stops offering them.
_OFFERED_BUT_UNSUPPORTED = {
    "trace_item_log": {"epm", "eps", "p100", "performance_score", "opportunity_score"},
}


def _ts_array(source: str, name: str) -> list[str]:
    match = re.search(rf"const {name}(?:: \w+\[\])? = \[(.*?)\];", source, re.DOTALL)
    assert match, f"{name} not found; update this parser to match the frontend source"
    return re.findall(r"AggregationKey\.(\w+)", match.group(1))


def _monitor_ui_aggregates() -> dict[str, set[str]]:
    """Mirrors getEAPAllowedAggregates in the monitor form: the functions the UI offers per
    event type, as backend function names."""
    fields_source = _FIELDS_TS.read_text()
    enum_match = re.search(r"export enum AggregationKey \{(.*?)\}", fields_source, re.DOTALL)
    assert enum_match, "AggregationKey not found; update this parser to match the frontend source"
    function_names = dict(re.findall(r"(\w+) = '([^']+)'", enum_match.group(1)))

    visualize_source = _MONITOR_VISUALIZE_TSX.read_text()
    offered = _ts_array(fields_source, "ALLOWED_EXPLORE_VISUALIZE_AGGREGATES") + _ts_array(
        visualize_source, "ADDITIONAL_EAP_AGGREGATES"
    )
    logs_excluded = _ts_array(visualize_source, "LOGS_EXCLUDED_AGGREGATES")
    return {
        "trace_item_span": {function_names[key] for key in offered},
        "trace_item_log": {function_names[key] for key in offered if key not in logs_excluded},
    }


@pytest.mark.parametrize(
    ("event_type", "title"), [("trace_item_span", "Spans"), ("trace_item_log", "Logs")]
)
def test_monitor_ui_aggregates_are_in_schema(event_type: str, title: str) -> None:
    """The monitor UI lists its aggregates in TypeScript, separately from EAP_FUNCTIONS. They
    drifted before: the UI offered opportunity_score for months while the backend rejected it.
    A failure means the UI offers a function that EAP_FUNCTIONS (src/sentry/incidents/logic.py)
    or the dataset's definitions don't support. Add it there, or stop offering it."""
    offered = _monitor_ui_aggregates()[event_type]
    assert offered

    unsupported = sorted(
        function
        for function in offered - _OFFERED_BUT_UNSUPPORTED.get(event_type, set())
        if _matching_titles(
            _data_source("events_analytics_platform", [event_type], f"{function}()")
        )
        != [title]
    )
    assert unsupported == []
