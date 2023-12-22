from typing import List, Mapping, Optional

import pytest

from sentry.spans.grouping.strategy.base import (
    Span,
    SpanGroupingStrategy,
    loose_normalized_db_span_in_condition_strategy,
    normalized_db_span_in_condition_strategy,
    parametrize_db_span_strategy,
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
from sentry.testutils.performance_issues.span_builder import SpanBuilder


def test_register_duplicate_confiig() -> None:
    config_id = "test-configuration"
    register_configuration(config_id, [])
    with pytest.raises(ValueError, match=f"Duplicate configuration id: {config_id}"):
        register_configuration(config_id, [])


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
        # op is db
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
        # op is a db query
        (
            SpanBuilder()
            .with_op("db.sql.query")
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
        # description has multiple IN statements
        (
            SpanBuilder()
            .with_op("db.sql.query")
            .with_description(
                "SELECT count() FROM table WHERE id IN (%s, %s) AND id IN (%s, %s, %s)"
            )
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s) AND id IN (%s)"],
        ),
        # supports unparametrized queries
        (
            SpanBuilder()
            .with_op("db.sql.query")
            .with_description("SELECT count() FROM table WHERE id IN (100, 101, 102)")
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        # supports lowercase IN
        (
            SpanBuilder()
            .with_op("db.sql.query")
            .with_description("select count() from table where id in (100, 101, 102)")
            .build(),
            ["select count() from table where id IN (%s)"],
        ),
        # op is an ActiveRecord query
        (
            SpanBuilder()
            .with_op("db.sql.active_record")
            .with_description("SELECT count() FROM table WHERE id IN ($1, $2, $3)")
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        # op is a Laravel query
        (
            SpanBuilder()
            .with_op("db.sql.query")
            .with_description("SELECT count() FROM table WHERE id IN (?, ?, ?)")
            .build(),
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
    ],
)
def test_loose_normalized_db_span_in_condition_strategy(
    span: Span, fingerprint: Optional[List[str]]
) -> None:
    assert loose_normalized_db_span_in_condition_strategy(span) == fingerprint


@pytest.mark.parametrize(
    "query,fingerprint",
    [
        # parametrizes numbers
        ("SELECT * FROM table WHERE id = 1", ["SELECT * FROM table WHERE id = %s"]),
        ("SELECT * FROM table LIMIT 1", ["SELECT * FROM table LIMIT %s"]),
        (
            "SELECT * FROM table WHERE temperature > -100",
            ["SELECT * FROM table WHERE temperature > %s"],
        ),
        ("SELECT * FROM table WHERE salary > 1e7", ["SELECT * FROM table WHERE salary > %s"]),
        ("SELECT * FROM table123 WHERE id = %s", None),
        ("SELECT * FROM ta123ble WHERE id = %s", None),
        ("SELECT * FROM `123table` WHERE id = %s", None),
        # parametrizes single-quoted strings
        ("SELECT * FROM table WHERE sku = 'foo'", ["SELECT * FROM table WHERE sku = %s"]),
        (
            "SELECT * FROM table WHERE quote = 'it\\'s a string",
            ["SELECT * FROM table WHERE quote = %s"],
        ),
        # leaves double-quoted strings (used for string literals in MySQL but identifiers in PostgreSQL)
        ('SELECT * from "table" WHERE sku = %s', None),  # PG
        ('SELECT * from table WHERE sku = "foo"', None),  # MySQL
        # parametrizes booleans
        ("SELECT * FROM table WHERE deleted = true", ["SELECT * FROM table WHERE deleted = %s"]),
        ("SELECT * FROM table WHERE deleted = false", ["SELECT * FROM table WHERE deleted = %s"]),
        ("SELECT * FROM table_true WHERE deleted = %s", None),
        ("SELECT * FROM true_table WHERE deleted = %s", None),
        ("SELECT * FROM tatrueble WHERE deleted = %s", None),
        # leaves nulls alone
        ("SELECT * FROM table WHERE deleted_at IS NULL", None),
        # supports all the cases loose_normalized_db_span_in_condition_strategy does
        (
            "SELECT count() FROM table WHERE id IN (%s, %s) AND id IN (%s, %s, %s)",
            ["SELECT count() FROM table WHERE id IN (%s) AND id IN (%s)"],
        ),
        (
            "SELECT count() FROM table WHERE id IN (100, 101, 102)",
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        (
            "select count() from table where id in (100, 101, 102)",
            ["select count() from table where id IN (%s)"],
        ),
        (
            "SELECT count() FROM table WHERE id IN ($1, $2, $3)",
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        (
            "SELECT count() FROM table WHERE id IN (?, ?, ?)",
            ["SELECT count() FROM table WHERE id IN (%s)"],
        ),
        # supports SAVEPOINTS with unquoted, backtick-quoted (MySQL), or
        # double-quoted (PostgreSQL) identifiers
        ("SAVEPOINT unquoted_identifier", ["SAVEPOINT %s"]),
        ("SAVEPOINT unquoted_identifier;", ["SAVEPOINT %s;"]),
        ("savepoint unquoted_identifier", ["SAVEPOINT %s"]),
        (
            'SAVEPOINT "pg_quoted_identifier"',
            ["SAVEPOINT %s"],
        ),
        (
            "SAVEPOINT `mysql_quoted_identifier`",
            ["SAVEPOINT %s"],
        ),
    ],
)
def test_parametrize_db_span_strategy(query: str, fingerprint: Optional[List[str]]) -> None:
    span = SpanBuilder().with_op("db.sql.query").with_description(query).build()
    assert parametrize_db_span_strategy(span) == fingerprint


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
        # best effort when description is not a valid url
        (
            SpanBuilder()
            .with_op("http.client")
            .with_description("GET https://[this-is-not-a-valid-url?query")
            .build(),
            ["GET", "https", "[this-is-not-a-valid-url", ""],
        ),
        pytest.param(
            SpanBuilder()
            .with_op("http.client")
            .with_description("GET https://[Filtered]@3x.png")
            .build(),
            ["GET", "https", "[Filtered]@3x.png", ""],
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
        (SpanBuilder().with_op("db.redis").with_description("INCRBY 'key' 1").build(), ["INCRBY"]),
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
                .with_fingerprint(["a"])
                .build(),
                SpanBuilder().with_span_id("c" * 16).with_description("hi").build(),
                SpanBuilder()
                .with_span_id("d" * 16)
                .with_description("bye")
                .with_fingerprint(["a"])
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


@pytest.mark.parametrize(
    "spans,expected",
    [
        ([], {}),
        (
            [
                SpanBuilder()
                .with_span_id("b" * 16)
                .with_op("db.sql.query")
                .with_description("SELECT * FROM table WHERE id IN (1, 2, 3)")
                .build(),
                SpanBuilder()
                .with_span_id("c" * 16)
                .with_op("db.sql.query")
                .with_description("SELECT * FROM table WHERE id IN (4, 5, 6)")
                .build(),
                SpanBuilder()
                .with_span_id("d" * 16)
                .with_op("db.sql.query")
                .with_description("SELECT * FROM table WHERE id IN (7, 8, 9)")
                .build(),
            ],
            {
                "b" * 16: ["SELECT * FROM table WHERE id IN (%s)"],
                "c" * 16: ["SELECT * FROM table WHERE id IN (%s)"],
                "d" * 16: ["SELECT * FROM table WHERE id IN (%s)"],
            },
        ),
    ],
)
def test_default_2022_10_04_strategy(spans: List[Span], expected: Mapping[str, List[str]]) -> None:
    event = {
        "transaction": "transaction name",
        "contexts": {
            "trace": {
                "span_id": "a" * 16,
            },
        },
        "spans": spans,
    }
    configuration = CONFIGURATIONS["default:2022-10-04"]
    assert configuration.execute_strategy(event).results == {
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
                .with_op("db.sql.query")
                .with_description("SELECT * FROM table WHERE id = 1")
                .build(),
                SpanBuilder()
                .with_span_id("c" * 16)
                .with_op("db.sql.query")
                .with_description("SELECT * FROM table WHERE id IN (4, 5, 6)")
                .build(),
                SpanBuilder()
                .with_span_id("d" * 16)
                .with_op("db.sql.query")
                .with_description("SELECT * FROM table WHERE id = 'string'")
                .build(),
            ],
            {
                "b" * 16: ["SELECT * FROM table WHERE id = %s"],
                "c" * 16: ["SELECT * FROM table WHERE id IN (%s)"],
                "d" * 16: ["SELECT * FROM table WHERE id = %s"],
            },
        ),
    ],
)
def test_default_2022_10_27_strategy(spans: List[Span], expected: Mapping[str, List[str]]) -> None:
    event = {
        "transaction": "transaction name",
        "contexts": {
            "trace": {
                "span_id": "a" * 16,
            },
        },
        "spans": spans,
    }
    configuration = CONFIGURATIONS["default:2022-10-27"]
    assert configuration.execute_strategy(event).results == {
        key: hash_values(values)
        for key, values in {**expected, "a" * 16: ["transaction name"]}.items()
    }
