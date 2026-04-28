from datetime import datetime, timezone

import pytest
from django.http import QueryDict

from sentry.exceptions import InvalidParams
from sentry.release_health.base import AllowedResolution
from sentry.snuba.sessions_v2 import (
    QueryDefinition,
    get_constrained_date_range,
    get_timestamps,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all


def _make_query(qs, params=None):
    return QueryDefinition(QueryDict(qs), params or {})


@freeze_time("2018-12-11 03:21:00")
def test_round_range() -> None:
    start, end, interval = get_constrained_date_range({"statsPeriod": "2d"})
    assert start == datetime(2018, 12, 9, 3, tzinfo=timezone.utc)
    assert end == datetime(2018, 12, 11, 4, 00, tzinfo=timezone.utc)

    start, end, interval = get_constrained_date_range({"statsPeriod": "2d", "interval": "1d"})
    assert start == datetime(2018, 12, 9, tzinfo=timezone.utc)
    assert end == datetime(2018, 12, 12, 0, 0, tzinfo=timezone.utc)


def test_invalid_interval() -> None:
    with pytest.raises(InvalidParams):
        start, end, interval = get_constrained_date_range({"interval": "0d"})


def test_round_exact() -> None:
    start, end, interval = get_constrained_date_range(
        {"start": "2021-01-12T04:06:16", "end": "2021-01-17T08:26:13", "interval": "1d"},
    )
    assert start == datetime(2021, 1, 12, tzinfo=timezone.utc)
    assert end == datetime(2021, 1, 18, tzinfo=timezone.utc)


def test_inclusive_end() -> None:
    start, end, interval = get_constrained_date_range(
        {"start": "2021-02-24T00:00:00", "end": "2021-02-25T00:00:00", "interval": "1h"},
    )
    assert start == datetime(2021, 2, 24, tzinfo=timezone.utc)
    assert end == datetime(2021, 2, 25, 0, tzinfo=timezone.utc)


@freeze_time("2021-03-05T11:00:00.000Z")
def test_future_request() -> None:
    start, end, interval = get_constrained_date_range(
        {"start": "2021-03-05T12:00:00", "end": "2021-03-05T13:00:00", "interval": "1h"},
    )
    assert start == datetime(2021, 3, 5, 11, tzinfo=timezone.utc)
    assert end == datetime(2021, 3, 5, 13, 0, tzinfo=timezone.utc)


@freeze_time("2021-03-05T11:14:17.105Z")
def test_interval_restrictions() -> None:
    # making sure intervals are cleanly divisible
    with pytest.raises(InvalidParams, match="The interval has to be less than one day."):
        _make_query("statsPeriod=4d&interval=2d&field=sum(session)")
    with pytest.raises(
        InvalidParams, match="The interval should divide one day without a remainder."
    ):
        _make_query("statsPeriod=6h&interval=59m&field=sum(session)")
    with pytest.raises(
        InvalidParams, match="The interval should divide one day without a remainder."
    ):
        _make_query("statsPeriod=4d&interval=5h&field=sum(session)")

    _make_query("statsPeriod=6h&interval=90m&field=sum(session)")
    with pytest.raises(
        InvalidParams,
        match="The interval has to be a multiple of the minimum interval of one hour.",
    ):
        get_constrained_date_range(
            QueryDict("statsPeriod=6h&interval=90m"), AllowedResolution.one_hour
        )

    with pytest.raises(
        InvalidParams,
        match="The interval has to be a multiple of the minimum interval of one minute.",
    ):
        get_constrained_date_range(
            QueryDict("statsPeriod=1h&interval=90s"), AllowedResolution.one_minute
        )

    with pytest.raises(
        InvalidParams, match="Your interval and date range would create too many results."
    ):
        _make_query("statsPeriod=90d&interval=1h&field=sum(session)")


@freeze_time("2020-12-18T11:14:17.105Z")
def test_timestamps() -> None:
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)")

    expected_timestamps = ["2020-12-17T00:00:00Z", "2020-12-17T12:00:00Z", "2020-12-18T00:00:00Z"]
    actual_timestamps = get_timestamps(query)
    assert actual_timestamps == expected_timestamps


@freeze_time("2021-03-08T09:34:00.000Z")
def test_hourly_rounded_start() -> None:
    query = _make_query("statsPeriod=30m&interval=1m&field=sum(session)")

    actual_timestamps = get_timestamps(query)

    assert actual_timestamps[0] == "2021-03-08T09:04:00Z"
    assert actual_timestamps[-1] == "2021-03-08T09:33:00Z"
    assert len(actual_timestamps) == 30

    # in this case "45m" means from 08:49:00-09:34:00, but since we round start/end
    # to hours, we extend the start time to 08:00:00.
    query = _make_query("statsPeriod=45m&interval=1m&field=sum(session)")

    actual_timestamps = get_timestamps(query)

    assert actual_timestamps[0] == "2021-03-08T08:49:00Z"
    assert actual_timestamps[-1] == "2021-03-08T09:33:00Z"
    assert len(actual_timestamps) == 45


def test_rounded_end() -> None:
    query = _make_query(
        "field=sum(session)&interval=1h&start=2021-02-24T00:00:00Z&end=2021-02-25T00:00:00Z"
    )

    expected_timestamps = [
        "2021-02-24T00:00:00Z",
        "2021-02-24T01:00:00Z",
        "2021-02-24T02:00:00Z",
        "2021-02-24T03:00:00Z",
        "2021-02-24T04:00:00Z",
        "2021-02-24T05:00:00Z",
        "2021-02-24T06:00:00Z",
        "2021-02-24T07:00:00Z",
        "2021-02-24T08:00:00Z",
        "2021-02-24T09:00:00Z",
        "2021-02-24T10:00:00Z",
        "2021-02-24T11:00:00Z",
        "2021-02-24T12:00:00Z",
        "2021-02-24T13:00:00Z",
        "2021-02-24T14:00:00Z",
        "2021-02-24T15:00:00Z",
        "2021-02-24T16:00:00Z",
        "2021-02-24T17:00:00Z",
        "2021-02-24T18:00:00Z",
        "2021-02-24T19:00:00Z",
        "2021-02-24T20:00:00Z",
        "2021-02-24T21:00:00Z",
        "2021-02-24T22:00:00Z",
        "2021-02-24T23:00:00Z",
    ]
    actual_timestamps = get_timestamps(query)

    assert len(actual_timestamps) == 24
    assert actual_timestamps == expected_timestamps


def test_simple_query() -> None:
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)")

    assert query.query_columns == ["sessions"]


def test_groupby_query() -> None:
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)&groupBy=release")

    assert sorted(query.query_columns) == ["release", "sessions"]
    assert query.query_groupby == ["release"]


def test_virtual_groupby_query() -> None:
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)&groupBy=session.status")

    assert sorted(query.query_columns) == [
        "sessions",
        "sessions_abnormal",
        "sessions_crashed",
        "sessions_errored",
        "sessions_unhandled",
    ]
    assert query.query_groupby == []

    query = _make_query(
        "statsPeriod=1d&interval=12h&field=count_unique(user)&groupBy=session.status"
    )

    assert sorted(query.query_columns) == [
        "users",
        "users_abnormal",
        "users_crashed",
        "users_errored",
        "users_unhandled",
    ]
    assert query.query_groupby == []


@freeze_time("2022-05-04T09:00:00.000Z")
def _get_query_maker_params(project):
    # These parameters are computed in the API endpoint, before the
    # QueryDefinition is built. Since we're only testing the query
    # definition here, we can safely mock these.
    return {
        "start": datetime.now(),
        "end": datetime.now(),
        "organization_id": project.organization_id,
    }


@django_db_all
def test_filter_proj_slug_in_query(default_project) -> None:
    params = _get_query_maker_params(default_project)
    params["project_id"] = [default_project.id]
    query_def = _make_query(
        f"field=sum(session)&interval=2h&statsPeriod=2h&query=project%3A{default_project.slug}",
        params=params,
    )
    assert query_def.query == f"project:{default_project.slug}"
    assert query_def.params["project_id"] == [default_project.id]


@django_db_all
def test_filter_proj_slug_in_top_filter(default_project) -> None:
    params = _get_query_maker_params(default_project)
    params["project_id"] = [default_project.id]
    query_def = _make_query(
        f"field=sum(session)&interval=2h&statsPeriod=2h&project={default_project.id}",
        params=params,
    )
    assert query_def.query == ""
    assert query_def.params["project_id"] == [default_project.id]


@django_db_all
def test_filter_proj_slug_in_top_filter_and_query(default_project) -> None:
    params = _get_query_maker_params(default_project)
    params["project_id"] = [default_project.id]
    query_def = _make_query(
        f"field=sum(session)&interval=2h&statsPeriod=2h&project={default_project.id}&query=project%3A"
        f"{default_project.slug}",
        params=params,
    )
    assert query_def.query == f"project:{default_project.slug}"
    assert query_def.params["project_id"] == [default_project.id]


@django_db_all
def test_proj_neither_in_top_filter_nor_query(default_project) -> None:
    params = _get_query_maker_params(default_project)
    query_def = _make_query(
        "field=sum(session)&interval=2h&statsPeriod=2h",
        params=params,
    )
    assert query_def.query == ""
    assert "project_id" not in query_def.params


@django_db_all
def test_filter_env_in_query(default_project) -> None:
    env = "prod"
    params = _get_query_maker_params(default_project)
    query_def = _make_query(
        f"field=sum(session)&interval=2h&statsPeriod=2h&query=environment%3A{env}",
        params=params,
    )
    assert query_def.query == f"environment:{env}"


@django_db_all
def test_filter_env_in_top_filter(default_project) -> None:
    env = "prod"
    params = _get_query_maker_params(default_project)
    params["environment"] = "prod"
    query_def = _make_query(
        f"field=sum(session)&interval=2h&statsPeriod=2h&environment={env}",
        params=params,
    )
    assert query_def.query == ""


@django_db_all
def test_filter_env_in_top_filter_and_query(default_project) -> None:
    env = "prod"
    params = _get_query_maker_params(default_project)
    params["environment"] = "prod"
    query_def = _make_query(
        f"field=sum(session)&interval=2h&statsPeriod=2h&environment={env}&query=environment%3A{env}",
        params=params,
    )
    assert query_def.query == f"environment:{env}"


@django_db_all
def test_env_neither_in_top_filter_nor_query(default_project) -> None:
    params = _get_query_maker_params(default_project)
    query_def = _make_query(
        "field=sum(session)&interval=2h&statsPeriod=2h",
        params=params,
    )
    assert query_def.query == ""
