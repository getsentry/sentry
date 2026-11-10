from __future__ import annotations

from typing import Any

import pytest

from sentry.investigations.services.action_kinds.update_detector import (
    UpdateDetectorActionSerializer,
)

ACTION = {
    "kind": "update_detector",
    "detectorId": "4821",
    "before": {"timeWindowSeconds": 300, "highThreshold": 500},
    "changes": {"timeWindowSeconds": 900, "highThreshold": 800.5},
}


def validated(action: dict[str, Any]) -> dict[str, Any] | None:
    serializer = UpdateDetectorActionSerializer(data=action)
    return dict(serializer.validated_data) if serializer.is_valid() else None


def test_accepts_the_wire_shape() -> None:
    assert validated(ACTION) == {
        "kind": "update_detector",
        "detectorId": "4821",
        "before": {"timeWindowSeconds": 300, "highThreshold": 500.0},
        "changes": {"timeWindowSeconds": 900, "highThreshold": 800.5},
    }


def test_accepts_text_changes() -> None:
    action = {
        **ACTION,
        "before": {"query": "", "aggregate": "count()", "environment": None},
        "changes": {
            "query": "!error.handled:true",
            "aggregate": "count_unique(user)",
            "environment": "production",
        },
    }

    assert validated(action) == action


@pytest.mark.parametrize(
    "overrides",
    [
        {"kind": None},
        {"detectorId": 4821},
        {"detectorId": "48a1"},
        {"detectorId": "1" * 33},
        {"detectorId": "9" * 20},
        {"before": {"timeWindowSeconds": 300}, "changes": {"timeWindowSeconds": 2**40}},
        {"before": {}, "changes": {}},
        {"before": {"timeWindowSeconds": 300}, "changes": {"highThreshold": 1.0}},
        {"before": {"timeWindowSeconds": 300}, "changes": {"timeWindowSeconds": 300}},
        {"before": {"timeWindowSeconds": 300}, "changes": {"timeWindowSeconds": 0}},
        {"before": {"timeWindowSeconds": 300}, "changes": {"timeWindowSeconds": 900.5}},
        {"before": {"highThreshold": "1"}, "changes": {"highThreshold": 2}},
        {"before": {"highThreshold": True}, "changes": {"highThreshold": 2}},
        {"before": {"detectionType": "static"}, "changes": {"detectionType": "dynamic"}},
        {"before": {"query": ""}, "changes": {"query": ""}},
        {"before": {"query": ""}, "changes": {"query": 5}},
        {"before": {"aggregate": "count()"}, "changes": {"aggregate": ""}},
        {
            "before": {"comparisonDeltaSeconds": 3600},
            "changes": {"comparisonDeltaSeconds": 86400},
        },
    ],
)
def test_rejects_invalid_changes(overrides: dict[str, Any]) -> None:
    assert validated({**ACTION, **overrides}) is None


def test_trim_drops_changes_sentry_cannot_store() -> None:
    kept = UpdateDetectorActionSerializer.trim(
        {
            **ACTION,
            "before": {"query": "x" * 2_001, "timeWindowSeconds": 300},
            "changes": {"query": "level:error", "timeWindowSeconds": 900},
        }
    )

    assert kept is not None
    assert (kept["before"], kept["changes"]) == (
        {"timeWindowSeconds": 300},
        {"timeWindowSeconds": 900},
    )
    for before, changes in (
        ({"query": ""}, {"query": "x" * 2_001}),
        ({"environment": "x" * 65}, {"environment": "prod"}),
        ({"aggregate": None}, {"aggregate": "count()"}),
    ):
        assert (
            UpdateDetectorActionSerializer.trim({**ACTION, "before": before, "changes": changes})
            is None
        )
    assert UpdateDetectorActionSerializer.trim(ACTION) == ACTION


def test_accepts_settings_seer_relied_on_but_did_not_change() -> None:
    action = {
        **ACTION,
        "before": {"timeWindowSeconds": 300, "aggregate": "p95(transaction.duration)"},
        "changes": {"timeWindowSeconds": 900},
    }

    assert validated(action) is not None


def test_trim_drops_long_text_from_unchanged_settings_too() -> None:
    action = {
        **ACTION,
        "before": {"query": "x" * 2_001, "timeWindowSeconds": 300},
        "changes": {"timeWindowSeconds": 900},
    }

    trimmed = UpdateDetectorActionSerializer.trim(action)

    assert trimmed is not None
    assert (trimmed["before"], trimmed["changes"]) == (
        {"timeWindowSeconds": 300},
        {"timeWindowSeconds": 900},
    )
