from datetime import timedelta

import pytest
from django.utils import timezone
from snuba_sdk import Column, Condition, Function, Op

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
            {SessionStatus.ABNORMAL, SessionStatus.ERRORED},
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
            {SessionStatus.HEALTHY, SessionStatus.ERRORED, SessionStatus.CRASHED},
        ),
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.NOT_IN, ["abnormal", "bogus"]),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            {SessionStatus.HEALTHY, SessionStatus.ERRORED, SessionStatus.CRASHED},
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
def test_transform_conditions(input, expected_output, expected_status_filter):
    output, status_filter = _extract_status_filter_from_conditions(input)
    assert output == expected_output
    assert status_filter == expected_status_filter


@pytest.mark.parametrize("input", [[Condition(Column("release"), Op.EQ, "foo")]])
def test_transform_conditions_nochange(input):
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
def test_transform_conditions_illegal(input):
    pytest.raises(InvalidParams, _extract_status_filter_from_conditions, input)
