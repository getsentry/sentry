from collections.abc import Generator
from unittest.mock import patch

import pytest

from sentry.telemetry_classifiers.inputs import fit_events
from sentry.telemetry_classifiers.types import PreparedInput

# Each event below serializes to 10 characters, e.g. {"n":"aa"}.
OLDEST = {"n": "aa"}
OLDER = {"n": "bb"}
NEWEST = {"n": "cc"}


@pytest.fixture(autouse=True)
def input_limit() -> Generator[None]:
    with patch("sentry.telemetry_classifiers.inputs.MAX_INPUT_CHARS", 25):
        yield


def test_keeps_events_within_limit_in_order() -> None:
    assert fit_events([OLDER, NEWEST]) == PreparedInput(events=(OLDER, NEWEST), truncated=False)


def test_keeps_newest_events_when_input_is_too_large() -> None:
    assert fit_events([OLDEST, OLDER, NEWEST]) == PreparedInput(
        events=(OLDER, NEWEST), truncated=True
    )


def test_stops_at_the_first_event_that_does_not_fit() -> None:
    large = {"n": "x" * 20}

    assert fit_events([OLDEST, large, NEWEST]) == PreparedInput(events=(NEWEST,), truncated=True)


def test_returns_no_events_when_the_newest_does_not_fit() -> None:
    assert fit_events([OLDEST, {"n": "x" * 30}]) == PreparedInput(events=(), truncated=True)


def test_returns_no_events_for_empty_input() -> None:
    assert fit_events([]) == PreparedInput(events=(), truncated=False)
