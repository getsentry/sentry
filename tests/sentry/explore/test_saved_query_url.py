from typing import Any
from unittest import mock

import pytest
from django.test import override_settings

from sentry.explore.saved_query_url import build_explore_saved_query_url


@pytest.fixture(autouse=True)
def customer_domain():
    """Serve every URL the way sentry.io does, so the expected links are the real ones."""
    with (
        override_settings(
            SENTRY_ORGANIZATION_URL_TEMPLATE="https://{hostname}",
            SENTRY_ORGANIZATION_BASE_HOSTNAME="{slug}.sentry.io",
        ),
        mock.patch("sentry.explore.saved_query_url.has_customer_domain", return_value=True),
    ):
        yield


def saved_query(**overrides: Any) -> Any:
    query: dict[str, Any] = {
        "id": "2419246",
        "name": "Slowest Spans – Docs",
        "dataset": "spans",
        "projects": [1267915],
        "range": "24h",
        "query": [
            {
                "mode": "samples",
                "query": "",
                "fields": ["span.op", "span.description", "span.duration", "transaction", "trace"],
                "orderby": "-span.duration",
            }
        ],
    }
    query.update(overrides)
    return query


def test_restores_the_query_the_way_the_saved_queries_table_does() -> None:
    # The URL Explore itself produces for saved query 2419246, character for
    # character. The agent that created this query linked
    # `/explore/spans/?savedQueryId=2419246` instead -- a route that does not
    # exist, keyed by a param that does not either (CW-2081).
    assert build_explore_saved_query_url(saved_query(), "sentry") == (
        "https://sentry.sentry.io/explore/traces/"
        "?field=span.op&field=span.description&field=span.duration&field=transaction&field=trace"
        "&groupBy=&id=2419246&mode=samples&project=1267915&query="
        "&sort=-span.duration&statsPeriod=24h&title=Slowest%20Spans%20%E2%80%93%20Docs"
    )


def test_carries_the_page_filters_the_query_was_saved_with() -> None:
    url = build_explore_saved_query_url(
        saved_query(environment=["prod"], range=None, start="2026-09-15T21:32:30.494000Z"),
        "sentry",
    )
    assert url is not None
    assert "environment=prod" in url
    assert "start=2026-09-15T21%3A32%3A30.494" in url
    assert "statsPeriod" not in url


def test_sends_an_empty_project_list_as_my_projects() -> None:
    url = build_explore_saved_query_url(saved_query(projects=[]), "sentry")
    assert url is not None
    # Empty rather than absent: absent would fall back to the viewer's own
    # last project selection.
    assert "&project=&" in url


def test_encodes_an_aggregate_query_as_its_own_params() -> None:
    url = build_explore_saved_query_url(
        saved_query(
            query=[
                {
                    "mode": "aggregate",
                    "query": "span.op:http.client",
                    "fields": ["id", "span.duration"],
                    "groupby": ["span.op"],
                    "orderby": "-p95(span.duration)",
                    "visualize": [{"yAxes": ["p95(span.duration)"], "chartType": 1}],
                }
            ]
        ),
        "sentry",
    )
    assert url is not None
    assert "mode=aggregate" in url
    assert "groupBy=span.op" in url
    assert "query=span.op%3Ahttp.client" in url
    # Each visualize entry rides as its own compact JSON value.
    assert (
        "visualize=%7B%22yAxes%22%3A%5B%22p95%28span.duration%29%22%5D%2C%22chartType%22%3A1%7D"
        in url
    )


def test_links_logs_to_the_logs_surface_with_its_own_params() -> None:
    url = build_explore_saved_query_url(
        saved_query(
            dataset="logs",
            query=[
                {
                    "mode": "samples",
                    "query": "severity:error",
                    "fields": ["message", "timestamp"],
                    "orderby": "-timestamp",
                }
            ],
        ),
        "sentry",
    )
    assert url is not None
    assert url.startswith("https://sentry.sentry.io/explore/logs/?")
    # Logs ignores the generic `query=`; it reads `logsQuery`.
    assert "logsQuery=severity%3Aerror" in url
    assert "logsFields=message&logsFields=timestamp" in url
    assert "logsSortBys=-timestamp" in url
    assert "&query=" not in url


def test_links_replays_and_conversations_to_their_own_surfaces() -> None:
    replays = build_explore_saved_query_url(
        saved_query(dataset="replays", query=[{"mode": "samples", "query": "browser:Chrome"}]),
        "sentry",
    )
    assert replays is not None
    assert replays.startswith("https://sentry.sentry.io/explore/replays/?")
    assert "query=browser%3AChrome" in replays

    conversations = build_explore_saved_query_url(
        saved_query(
            dataset="ai_conversations",
            agent=["my agent", "other"],
            query=[{"mode": "samples", "query": ""}],
        ),
        "sentry",
    )
    assert conversations is not None
    assert conversations.startswith("https://sentry.sentry.io/explore/agents/?")
    assert "agent=my%20agent%2Cother" in conversations


@pytest.mark.parametrize(
    "unbuildable",
    (
        # Metrics encodes its query state through the frontend's own serializers.
        pytest.param({"dataset": "metrics"}, id="metrics"),
        # A compare query is normalized on the frontend before it is encoded.
        pytest.param(
            {"query": [{"mode": "samples", "query": "a"}, {"mode": "samples", "query": "b"}]},
            id="multi-query",
        ),
        pytest.param({"query": []}, id="no-query"),
        pytest.param({"dataset": "something-new"}, id="unknown-dataset"),
    ),
)
def test_gives_no_link_rather_than_a_wrong_one(unbuildable: dict[str, Any]) -> None:
    assert build_explore_saved_query_url(saved_query(**unbuildable), "sentry") is None
