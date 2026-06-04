from datetime import timedelta

import pytest
from django.utils import timezone
from snuba_sdk import Column, Condition, Function, Op
from snuba_sdk.conditions import ConditionGroup

from sentry.exceptions import InvalidParams
from sentry.release_health.metrics_sessions_v2 import (
    SessionStatus,
    _extract_status_filter_from_conditions,
)

pytestmark = pytest.mark.sentry_metrics

ONE_DAY_AGO = timezone.now() - timedelta(days=1)
MOCK_DATETIME = ONE_DAY_AGO.replace(hour=10, minute=0, second=0, microsecond=0)


@pytest.mark.parametrize(
    "input, expected_output, expected_status_filter",
    [
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.IN, ["abnormal", "errored"]),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            frozenset({SessionStatus.ABNORMAL, SessionStatus.ERRORED}),
        ),
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.EQ, "bogus"),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            frozenset(),
        ),
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.NEQ, "abnormal"),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            frozenset(
                {
                    SessionStatus.HEALTHY,
                    SessionStatus.ERRORED,
                    SessionStatus.CRASHED,
                    SessionStatus.UNHANDLED,
                }
            ),
        ),
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.NOT_IN, ["abnormal", "bogus"]),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            frozenset(
                {
                    SessionStatus.HEALTHY,
                    SessionStatus.ERRORED,
                    SessionStatus.CRASHED,
                    SessionStatus.UNHANDLED,
                }
            ),
        ),
        (
            [
                Condition(Column("session.status"), Op.EQ, "abnormal"),
                Condition(Column("session.status"), Op.EQ, "errored"),
            ],
            [],
            frozenset(),
        ),
    ],
)
def test_transform_conditions(
    input: ConditionGroup,
    expected_output: ConditionGroup,
    expected_status_filter: frozenset[SessionStatus],
) -> None:
    output, status_filter = _extract_status_filter_from_conditions(input)
    assert output == expected_output
    assert status_filter == expected_status_filter


@pytest.mark.parametrize("input", [[Condition(Column("release"), Op.EQ, "foo")]])
def test_transform_conditions_nochange(input: ConditionGroup) -> None:
    output, status_filter = _extract_status_filter_from_conditions(input)
    assert input == output
    assert status_filter is None


@pytest.mark.parametrize(
    "input",
    [
        [
            Condition(
                Function(
                    "or",
                    [
                        Function("equals", ["release", "foo"]),
                        Function("equals", ["session.status", "foo"]),
                    ],
                ),
                Op.EQ,
                1,
            )
        ],
    ],
)
def test_transform_conditions_illegal(input: ConditionGroup) -> None:
    pytest.raises(InvalidParams, _extract_status_filter_from_conditions, input)
