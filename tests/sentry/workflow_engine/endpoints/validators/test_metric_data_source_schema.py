import re
from typing import Any

import jsonschema
import pytest

from sentry.api.serializers.rest_framework.base import camel_to_snake_case, convert_dict_key_case
from sentry.apidocs.examples.workflow_engine_examples import WorkflowEngineExamples
from sentry.incidents.logic import check_aggregate_column_support
from sentry.utils import json
from sentry.workflow_engine.endpoints.validators.api_docs_help_text import DATA_SOURCES_HELP_TEXT
from sentry.workflow_engine.endpoints.validators.metric_data_source_schema import (
    ERRORS_AGGREGATES,
    METRIC_DATA_SOURCE_SCHEMA,
)
from tools.monitor_aggregates_to_json import OUTPUT_PATH, render


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


@pytest.mark.parametrize("example_index", [0, 1, 2])
def test_documented_create_examples_match_one_data_source(example_index: int) -> None:
    example = WorkflowEngineExamples.CREATE_DETECTOR[example_index]

    assert len(_matching_titles(example.value["dataSources"][0])) == 1


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
        _data_source(
            "events_analytics_platform", ["trace_item_log"], "equation|count() / count(message)"
        ),
        _data_source("metrics", [], "count()"),
    ],
)
def test_rejected_aggregates(data_source: dict[str, Any]) -> None:
    assert _matching_titles(data_source) == []


def test_generated_aggregates_are_current() -> None:
    with open(OUTPUT_PATH) as f:
        current = f.read()
    assert current == render(), (
        f"{OUTPUT_PATH} is out of date. "
        "Run `python3 -m tools.monitor_aggregates_to_json` to update it."
    )
