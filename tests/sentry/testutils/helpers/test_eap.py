from __future__ import annotations

from django.http import QueryDict

from sentry.testutils.helpers.eap import (
    EAP_DEFAULT_STATS_PERIOD,
    apply_eap_default_stats_period,
    is_eap_dataset,
)


def test_is_eap_dataset() -> None:
    assert is_eap_dataset("spans")
    assert is_eap_dataset("logs")
    assert is_eap_dataset("tracemetrics")
    assert is_eap_dataset("uptime_results")
    assert is_eap_dataset("preprodSize")
    assert not is_eap_dataset("discover")
    assert not is_eap_dataset(None)


def test_apply_defaults_for_dataset() -> None:
    query: dict[str, str] = {"dataset": "spans", "field": "count()"}
    apply_eap_default_stats_period(query)
    assert query["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD


def test_apply_defaults_for_item_type() -> None:
    query: dict[str, str] = {"itemType": "spans"}
    apply_eap_default_stats_period(query)
    assert query["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD


def test_apply_defaults_for_eap_path_without_dataset() -> None:
    query: dict[str, str] = {"project": "1"}
    apply_eap_default_stats_period(query, path="/api/0/organizations/org/trace-items/stats/")
    assert query["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD


def test_skips_full_retention_datasets() -> None:
    query: dict[str, str] = {"dataset": "uptime_results"}
    apply_eap_default_stats_period(query)
    assert "statsPeriod" not in query

    query = {"dataset": "preprodSize"}
    apply_eap_default_stats_period(query)
    assert "statsPeriod" not in query


def test_skips_when_window_already_set() -> None:
    query = {"dataset": "spans", "statsPeriod": "1h"}
    apply_eap_default_stats_period(query)
    assert query["statsPeriod"] == "1h"

    query = {"dataset": "spans", "start": "2024-01-01T00:00:00", "end": "2024-01-02T00:00:00"}
    apply_eap_default_stats_period(query)
    assert "statsPeriod" not in query


def test_skips_non_eap_datasets_and_paths() -> None:
    query: dict[str, str] = {"dataset": "discover"}
    apply_eap_default_stats_period(query)
    assert "statsPeriod" not in query

    query = {"project": "1"}
    apply_eap_default_stats_period(query, path="/api/0/organizations/org/events/")
    assert "statsPeriod" not in query


def test_applies_to_query_string() -> None:
    result = apply_eap_default_stats_period(
        "dataset=spans&field=count%28%29",
        path="/api/0/organizations/org/events/",
    )
    params = QueryDict(result)
    assert params["dataset"] == "spans"
    assert params["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD


def test_preserves_query_string_when_no_default_needed() -> None:
    # Re-encoding would turn ``#`` into ``%23`` and break non-EAP redirect tests.
    original = "param=test#hash"
    assert apply_eap_default_stats_period(original) is original
    assert apply_eap_default_stats_period(original, path="/settings/integrations/") is original


def test_applies_default_for_empty_query_on_eap_path() -> None:
    result = apply_eap_default_stats_period({}, path="/api/0/organizations/org/trace-items/stats/")
    assert result["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD

    result = apply_eap_default_stats_period("", path="/api/0/organizations/org/ai-conversations/")
    params = QueryDict(result)
    assert params["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD


def test_preserves_existing_params_when_applying_default() -> None:
    # Django GET moves caller data into query_params; we must not drop dataset/itemType.
    query = {"dataset": "spans", "attributeType": "string"}
    apply_eap_default_stats_period(query, path="/api/0/organizations/org/trace-items/attributes/")
    assert query["dataset"] == "spans"
    assert query["attributeType"] == "string"
    assert query["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD

    result = apply_eap_default_stats_period(
        "dataset=spans&item_type=logs&trace_id=abc",
        path="/api/0/organizations/org/project/trace-items/1/",
    )
    params = QueryDict(result)
    assert params["dataset"] == "spans"
    assert params["item_type"] == "logs"
    assert params["trace_id"] == "abc"
    assert params["statsPeriod"] == EAP_DEFAULT_STATS_PERIOD
