from datetime import datetime, timedelta, timezone

import pytest
from snuba_sdk import AliasedExpression, Column, Condition, Function, Op

from sentry.search.events.builder import SpansIndexedQueryBuilder, SpansMetricsQueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def now():
    return datetime(2022, 10, 31, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def today(now):
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@pytest.fixture
def params(now, today):
    organization = Factories.create_organization()
    team = Factories.create_team(organization=organization)
    project1 = Factories.create_project(organization=organization, teams=[team])
    project2 = Factories.create_project(organization=organization, teams=[team])

    user = Factories.create_user()
    Factories.create_team_membership(team=team, user=user)

    return {
        "start": now - timedelta(days=7),
        "end": now - timedelta(seconds=1),
        "project_id": [project1.id, project2.id],
        "project_objects": [project1, project2],
        "organization_id": organization.id,
        "user_id": user.id,
        "team_id": [team.id],
    }


span_duration = Function(
    "if",
    [
        Function("greater", [Column("exclusive_time"), Column("duration")]),
        Column("exclusive_time"),
        Column("duration"),
    ],
    "span.duration",
)


@pytest.mark.parametrize(
    ["field", "expected"],
    [
        pytest.param("span.duration", span_duration, id="span.duration"),
        pytest.param(
            "profile.id",
            AliasedExpression(Column("profile_id"), alias="profile.id"),
            id="profile.id",
        ),
    ],
)
@django_db_all
def test_field_alias(params, field, expected):
    builder = SpansIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params,
        selected_columns=[field],
    )
    assert expected in builder.columns


@pytest.mark.parametrize(
    ["condition", "op", "value"],
    [
        pytest.param("1s", Op.EQ, 1000, id="=1s"),
        pytest.param(">1s", Op.GT, 1000, id=">1s"),
        pytest.param("<1s", Op.LT, 1000, id="<1s"),
        pytest.param(">=1s", Op.GTE, 1000, id=">=1s"),
        pytest.param("<=1s", Op.LTE, 1000, id="<=1s"),
    ],
)
@django_db_all
def test_span_duration_where(params, condition, op, value):
    builder = SpansIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params,
        query=f"span.duration:{condition}",
        selected_columns=["count"],
    )
    assert Condition(span_duration, op, value) in builder.where


@django_db_all
def test_foo(params):
    mid = params["start"] + (params["end"] - params["start"]) / 2
    builder = SpansMetricsQueryBuilder(
        params,
        dataset=Dataset.PerformanceMetrics,
        query="transaction:/api/0/projects/",
        selected_columns=[
            f"regression_score(span.self_time, {int(mid.timestamp())})",
            "span.group",
            "span.description",
        ],
        orderby=[f"-regression_score(span.self_time, {int(mid.timestamp())})"],
    )
    print(builder.get_snql_query())
    assert 0
