from __future__ import annotations

from typing import Any

from sentry.timeseries_annotations.producers.sdk_config_change import (
    describe,
    diff,
    fingerprint,
    normalize,
)


def _payload(**overrides: Any) -> dict[str, Any]:
    """A realistic sdk.config payload; an ``options`` override is shallow-merged into options."""
    options = {
        "tracesSampleRate": 0.2,
        "beforeSend": "[Function:1djg3ji]",
        "environment": "control",
        "release": "frontend@aaaa",
        "dsn": "https://k@o1.ingest.sentry.io/11276",
    }
    options.update(overrides.pop("options", {}))
    base: dict[str, Any] = {
        "version": 1,
        "sdk": {"name": "sentry.javascript.react", "version": "11.14.0", "settings": {}},
        "options": options,
        "options_set_by_user": ["tracesSampleRate", "beforeSend"],
        "integrations": [{"name": "Replay"}, {"name": "BrowserTracing"}],
        "timestamp": 1795020154.742,
        "release": "frontend@aaaa",
        "environment": "control",
    }
    base.update(overrides)
    return base


# --- normalize -------------------------------------------------------------


def test_normalize_strips_noise_keys() -> None:
    normalized = normalize(_payload())
    assert "timestamp" not in normalized
    assert "release" not in normalized
    assert "environment" not in normalized
    assert "release" not in normalized["options"]
    assert "dsn" not in normalized["options"]
    assert normalized["options"]["tracesSampleRate"] == 0.2
    assert normalized["sdk"]["version"] == "11.14.0"


def test_normalize_integrations_sorted() -> None:
    assert normalize(_payload())["integrations"] == ["BrowserTracing", "Replay"]


def test_normalize_order_insensitive_lists_sorted() -> None:
    a = normalize(_payload(options={"ignoreErrors": ["b", "a"]}))
    b = normalize(_payload(options={"ignoreErrors": ["a", "b"]}))
    assert a["options"]["ignoreErrors"] == ["a", "b"]
    assert fingerprint(a) == fingerprint(b)


# --- fingerprint -----------------------------------------------------------


def test_fingerprint_release_and_timestamp_siblings_collapse() -> None:
    # Same config on two deploys: only release/timestamp differ -> same fingerprint.
    v1 = normalize(_payload(release="frontend@aaaa", timestamp=1.0))
    v2 = normalize(_payload(release="frontend@bbbb", timestamp=2.0))
    assert fingerprint(v1) == fingerprint(v2)


def test_fingerprint_sample_rate_change_differs() -> None:
    v1 = normalize(_payload(options={"tracesSampleRate": 0.2}))
    v2 = normalize(_payload(options={"tracesSampleRate": 0.1}))
    assert fingerprint(v1) != fingerprint(v2)


def test_fingerprint_function_token_change_differs() -> None:
    # Token change is treated as a meaningful filter change.
    v1 = normalize(_payload(options={"beforeSend": "[Function:aaa]"}))
    v2 = normalize(_payload(options={"beforeSend": "[Function:bbb]"}))
    assert fingerprint(v1) != fingerprint(v2)


# --- diff ------------------------------------------------------------------


def test_diff_reorder_only_is_empty() -> None:
    a = normalize(_payload(options={"ignoreErrors": ["b", "a"]}))
    b = normalize(_payload(options={"ignoreErrors": ["a", "b"]}))
    assert diff(a, b) == {}


def test_diff_sample_rate_change_detected() -> None:
    a = normalize(_payload(options={"tracesSampleRate": 0.2}))
    b = normalize(_payload(options={"tracesSampleRate": 0.1}))
    assert diff(a, b)["options.tracesSampleRate"] == (0.2, 0.1)


def test_diff_integration_added() -> None:
    a = normalize(_payload(integrations=[{"name": "Replay"}]))
    b = normalize(_payload(integrations=[{"name": "Replay"}, {"name": "Feedback"}]))
    assert diff(a, b)["integrations"] == (["Replay"], ["Feedback", "Replay"])


# --- describe --------------------------------------------------------------


def test_describe_version_bump() -> None:
    a = normalize(_payload(sdk={"name": "x", "version": "11.13.0", "settings": {}}))
    b = normalize(_payload(sdk={"name": "x", "version": "11.14.0", "settings": {}}))
    assert describe(diff(a, b)) == "SDK config changed: SDK version 11.13.0 → 11.14.0"


def test_describe_sample_rate() -> None:
    a = normalize(_payload(options={"tracesSampleRate": 0.2}))
    b = normalize(_payload(options={"tracesSampleRate": 0.1}))
    assert describe(diff(a, b)) == "SDK config changed: tracesSampleRate 0.2 → 0.1"


def test_describe_integration_toggle() -> None:
    a = normalize(_payload(integrations=[{"name": "Replay"}]))
    b = normalize(_payload(integrations=[{"name": "Feedback"}]))
    desc = describe(diff(a, b))
    assert "enabled Feedback" in desc
    assert "disabled Replay" in desc


def test_describe_filter_function_change() -> None:
    a = normalize(_payload(options={"beforeSend": "[Function:aaa]"}))
    b = normalize(_payload(options={"beforeSend": "[Function:bbb]"}))
    assert describe(diff(a, b)) == "SDK config changed: changed beforeSend"


def test_demo() -> None:
    """Runnable self-check of the money path: a sampling drop yields one described change."""
    v1 = normalize(_payload(options={"tracesSampleRate": 0.2}, release="r1", timestamp=1.0))
    v2 = normalize(_payload(options={"tracesSampleRate": 0.1}, release="r2", timestamp=2.0))
    assert fingerprint(v1) != fingerprint(v2)  # release/timestamp noise ignored
    changes = diff(v1, v2)
    assert changes == {"options.tracesSampleRate": (0.2, 0.1)}
    assert describe(changes) == "SDK config changed: tracesSampleRate 0.2 → 0.1"
