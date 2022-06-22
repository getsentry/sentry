from typing import Any, List, Mapping, Optional

import pytest

from sentry.spans.grouping.strategy.base import (
    Span,
    SpanGroupingStrategy,
    normalized_db_span_in_condition_strategy,
    raw_description_strategy,
    remove_http_client_query_string_strategy,
    remove_redis_command_arguments_strategy,
)
from sentry.spans.grouping.strategy.config import (
    CONFIGURATIONS,
    SpanGroupingConfig,
    register_configuration,
)
from sentry.spans.grouping.utils import hash_values


def test_register_duplicate_config() -> None:
    config_id = "test-configuration"
    register_configuration(config_id, [])
    with pytest.raises(ValueError, match=f"Duplicate configuration id: {config_id}"):
        register_configuration(config_id, [])


class SpanBuilder:
    def __init__(self) -> None:
        self.trace_id: str = "a" * 32
        self.parent_span_id: Optional[str] = "a" * 16
        self.span_id: str = "b" * 16
        self.start_timestamp: float = 0
        self.timestamp: float = 1
        self.same_process_as_parent: bool = True
        self.op: str = "default"
        self.description: Optional[str] = None
        self.fingerprint: Optional[List[str]] = None
        self.tags: Optional[Any] = None
        self.data: Optional[Any] = None
        self.hash: Optional[str] = None

    def with_op(self, op: str) -> "SpanBuilder":
        self.op = op
        return self

    def with_description(self, description: Optional[str]) -> "SpanBuilder":
        self.description = description
        return self

    def with_span_id(self, span_id: str) -> "SpanBuilder":
        self.span_id = span_id
        return self

    def with_fingerprint(self, fingerprint: List[str]) -> "SpanBuilder":
        self.fingerprint = fingerprint
        return self

    def with_hash(self, hash: str) -> "SpanBuilder":
        self.hash = hash
        return self

    def build(self) -> Span:
        span = {
            "trace_id": self.trace_id,
            "parent_span_id": self.parent_span_id,
            "span_id": self.span_id,
            "start_timestamp": self.start_timestamp,
            "timestamp": self.timestamp,
            "same_process_as_parent": self.same_process_as_parent,
            "op": self.op,
            "description": self.description,
            "fingerprint": self.fingerprint,
            "tags": self.tags,
            "data": self.data,
        }
        if self.hash is not None:
            span["hash"] = self.hash
        return span


@pytest.mark.parametrize(
    "span,fingerprint",
    [
        (SpanBuilder().build(), [""]),
        (SpanBuilder().with_description("").build(), [""]),
        (SpanBuilder().with_description("test description").build(), ["test description"]),
    ],
)
def test_raw_description_strategy(span: Span, fingerprint: Optional[List[str]]) -> None:
    assert raw_description_strategy(span) == fingerprint


@pytest.mark.parametrize(
    "span,fingerprint",
    [
        (SpanBuilder().build(), None),
        # description does not have an IN condition
        (SpanBuilder().with_op("db").build(), None),
        # op is not db and description does have an IN condition
        (SpanBuilder().with_description("SELECT count() FROM table WHERE id = %s").build(), None),
        # description does not have an IN condition
        (
            SpanBuilder()
            .with_op("db")
            .with_description("SELECT count() FROM table WHERE id = %s")
            .build(),
            None,
        ),
        # op is not db
        (
            SpanBuilder().with_description("SELECT count() FROM table WHERE id IN (%s)").build(),
            None,
        ),
        (
            SpanBuilder()
            .with_op("db")
            .with_description("SELECT count() FROM table WHERE id IN (%s)")
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        (
            SpanBuilder()
            .with_op("db")
            .with_description("SELECT count() FROM table WHERE id IN (%s, %s)")
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        # the number of %s is relevant
        (
            SpanBuilder()
            .with_op("db")
            .with_description("SELECT count() FROM table WHERE id IN (%s, %s, %s, %s, %s)")
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        # the number of spaces around the commas is irrelevant
        (
            SpanBuilder()
            .with_op("db")
            .with_description("SELECT count() FROM table WHERE id IN (%s,%s , %s  ,  %s   ,   %s)")
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
    ],
)
def test_normalized_db_span_in_condition_strategy(
    span: Span, fingerprint: Optional[List[str]]
) -> None:
    assert normalized_db_span_in_condition_strategy(span) == fingerprint


@pytest.mark.parametrize(
    "span,fingerprint",
    [
        (SpanBuilder().build(), None),
        # description is not of form `<HTTP METHOD> <URL>`
        (SpanBuilder().with_op("http.client").build(), None),
        # op is not http.client
        (
            SpanBuilder()
            .with_description(
                "GET https://sentry.io/api/0/organization/sentry/projects/?all_projects=1"
            )
            .build(),
            None,
        ),
        # description is not of form `<HTTP METHOD> <URL>`
        (
            SpanBuilder().with_op("http.client").with_description("making an http request").build(),
            None,
        ),
        (
            SpanBuilder()
            .with_op("http.client")
            .with_description(
                "GET https://sentry.io/api/0/organization/sentry/projects/?all_projects=1"
            )
            .build(),
            ["GET", "https", "sentry.io", "/api/0/organization/sentry/projects/"],
        ),
    ],
)
def test_remove_http_client_query_string_strategy(
    span: Span, fingerprint: Optional[List[str]]
) -> None:
    assert remove_http_client_query_string_strategy(span) == fingerprint


@pytest.mark.parametrize(
    "span,fingerprint",
    [
        (SpanBuilder().build(), None),
        # op is not `redis`
        (SpanBuilder().with_description("INCRBY 'key' 1").build(), None),
        (SpanBuilder().with_op("redis").with_description("INCRBY 'key' 1").build(), ["INCRBY"]),
    ],
)
def test_remove_redis_command_arguments_strategy(
    span: Span, fingerprint: Optional[List[str]]
) -> None:
    assert remove_redis_command_arguments_strategy(span) == fingerprint


def test_reuse_existing_grouping_results() -> None:
    config_id = "test-configuration"
    strategy = SpanGroupingStrategy(config_id, [])
    config = SpanGroupingConfig(config_id, strategy)
    event = {
        "transaction": "transaction name",
        "contexts": {
            "trace": {
                "span_id": "a" * 16,
                "hash": "a" * 16,
            },
        },
        "spans": [
            SpanBuilder().with_span_id("b" * 16).with_hash("b" * 16).build(),
        ],
        "span_grouping_config": {
            "id": config_id,
        },
    }
    assert config.execute_strategy(event).results == {
        "a" * 16: "a" * 16,
        "b" * 16: "b" * 16,
    }


@pytest.mark.parametrize(
    "spans,expected",
    [
        ([], {}),
        ([SpanBuilder().with_span_id("b" * 16).build()], {"b" * 16: ""}),
        # group the ones with the same raw descriptions together
        (
            [
                SpanBuilder().with_span_id("b" * 16).with_description("hi").build(),
                SpanBuilder().with_span_id("c" * 16).with_description("hi").build(),
                SpanBuilder().with_span_id("d" * 16).with_description("bye").build(),
            ],
            {"b" * 16: "hi", "c" * 16: "hi", "d" * 16: "bye"},
        ),
        # fingerprints take precedence over the description
        (
            [
                SpanBuilder()
                .with_span_id("b" * 16)
                .with_description("hi")
                .with_fingerprint("a")
                .build(),
                SpanBuilder().with_span_id("c" * 16).with_description("hi").build(),
                SpanBuilder()
                .with_span_id("d" * 16)
                .with_description("bye")
                .with_fingerprint("a")
                .build(),
            ],
            {"b" * 16: "a", "c" * 16: "hi", "d" * 16: "a"},
        ),
    ],
)
def test_basic_span_grouping_strategy(spans: List[Span], expected: Mapping[str, List[str]]) -> None:
    event = {
        "transaction": "transaction name",
        "contexts": {
            "trace": {
                "span_id": "a" * 16,
            },
        },
        "spans": spans,
    }
    strategy = SpanGroupingStrategy(name="basic-strategy", strategies=[])
    assert strategy.execute(event) == {
        key: hash_values(values)
        for key, values in {**expected, "a" * 16: ["transaction name"]}.items()
    }


@pytest.mark.parametrize(
    "spans,expected",
    [
        ([], {}),
        (
            [
                SpanBuilder()
                .with_span_id("b" * 16)
                .with_op("http.client")
                .with_description(
                    "GET https://sentry.io/api/0/organization/sentry/projects/?all_projects=0"
                )
                .build(),
                SpanBuilder()
                .with_span_id("c" * 16)
                .with_op("http.client")
                .with_description(
                    "GET https://sentry.io/api/0/organization/sentry/projects/?all_projects=1"
                )
                .build(),
                SpanBuilder()
                .with_span_id("d" * 16)
                .with_op("http.client")
                .with_description(
                    "POST https://sentry.io/api/0/organization/sentry/projects/?all_projects=0"
                )
                .build(),
                SpanBuilder()
                .with_span_id("e" * 16)
                .with_description(
                    "GET https://sentry.io/api/0/organization/sentry/projects/?all_projects=0"
                )
                .build(),
                SpanBuilder().with_span_id("f" * 16).with_op("http.client").build(),
            ],
            {
                "b" * 16: ["GET", "https", "sentry.io", "/api/0/organization/sentry/projects/"],
                "c" * 16: ["GET", "https", "sentry.io", "/api/0/organization/sentry/projects/"],
                "d" * 16: ["POST", "https", "sentry.io", "/api/0/organization/sentry/projects/"],
                "e"
                * 16: ["GET https://sentry.io/api/0/organization/sentry/projects/?all_projects=0"],
                "f" * 16: [""],
            },
        ),
        (
            [
                SpanBuilder()
                .with_span_id("b" * 16)
                .with_op("db")
                .with_description("SELECT count() FROM table WHERE id IN (%s)")
                .build(),
                SpanBuilder()
                .with_span_id("c" * 16)
                .with_op("db")
                .with_description("SELECT count() FROM table WHERE id IN (%s, %s)")
                .build(),
                SpanBuilder()
                .with_span_id("d" * 16)
                .with_op("db")
                .with_description("SELECT count() FROM table WHERE id = %s")
                .build(),
                SpanBuilder()
                .with_span_id("e" * 16)
                .with_description("SELECT count() FROM table WHERE id IN (%s, %s)")
                .build(),
                SpanBuilder().with_span_id("f" * 16).with_op("db").build(),
            ],
            {
                "b" * 16: ["SELECT count() FROM table WHERE id IN (%s)"],
                "c" * 16: ["SELECT count() FROM table WHERE id IN (%s)"],
                "d" * 16: ["SELECT count() FROM table WHERE id = %s"],
                "e" * 16: ["SELECT count() FROM table WHERE id IN (%s, %s)"],
                "f" * 16: [""],
            },
        ),
        (
            [
                SpanBuilder()
                .with_span_id("b" * 16)
                .with_op("redis")
                .with_description("INCRBY 'key' 1")
                .build(),
                SpanBuilder()
                .with_span_id("c" * 16)
                .with_op("redis")
                .with_description("INCRBY 'key' 2")
                .build(),
                SpanBuilder()
                .with_span_id("d" * 16)
                .with_op("redis")
                .with_description("EXPIRE 'key' 1")
                .build(),
            ],
            {
                "b" * 16: ["INCRBY"],
                "c" * 16: ["INCRBY"],
                "d" * 16: ["EXPIRE"],
            },
        ),
    ],
)
def test_default_2021_08_25_strategy(spans: List[Span], expected: Mapping[str, List[str]]) -> None:
    event = {
        "transaction": "transaction name",
        "contexts": {
            "trace": {
                "span_id": "a" * 16,
            },
        },
        "spans": spans,
    }
    configuration = CONFIGURATIONS["default:2021-08-25"]
    assert configuration.execute_strategy(event).results == {
        key: hash_values(values)
        for key, values in {**expected, "a" * 16: ["transaction name"]}.items()
    }
