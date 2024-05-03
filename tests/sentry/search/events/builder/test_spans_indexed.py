from datetime import datetime, timedelta, timezone

import pytest
from snuba_sdk import AliasedExpression, Column, Condition, Function, Op

from sentry.search.events.builder import SpansIndexedQueryBuilder
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
    ["condition", "expected"],
    [
        pytest.param(
            "span.duration:1s", Condition(span_duration, Op.EQ, 1000), id="span.duration:1s"
        ),
        pytest.param(
            "span.duration:>1s", Condition(span_duration, Op.GT, 1000), id="span.duration:>1s"
        ),
        pytest.param(
            "span.duration:<1s", Condition(span_duration, Op.LT, 1000), id="span.duration:<1s"
        ),
        pytest.param(
            "span.duration:>=1s", Condition(span_duration, Op.GTE, 1000), id="span.duration:>=1s"
        ),
        pytest.param(
            "span.duration:<=1s", Condition(span_duration, Op.LTE, 1000), id="span.duration:<=1s"
        ),
        pytest.param(
            "span.duration:<=1s", Condition(span_duration, Op.LTE, 1000), id="span.duration:<=1s"
        ),
    ],
)
@django_db_all
def test_where(params, condition, expected):
    builder = SpansIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params,
        query=condition,
        selected_columns=["count"],
    )
    assert expected in builder.where


@django_db_all
def test_where_project(params):
    project = next(iter(params["project_objects"]))

    for query in [f"project:{project.slug}", f"project.id:{project.id}"]:
        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            query=query,
            selected_columns=["count"],
        )

        assert Condition(Column("project_id"), Op.EQ, project.id) in builder.where


@pytest.mark.parametrize(
    ["query", "result"],
    [
        pytest.param("span.op:params test", Condition(Column("description"), Op.EQ, "test")),
        pytest.param("testing", Condition(Column("description"), Op.EQ, "testing")),
        pytest.param(
            "span.description:test1 test2", Condition(Column("description"), Op.EQ, "test2")
        ),
    ],
)
@django_db_all
def test_free_text_search(params, query, result):
    builder = SpansIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params,
        query=query,
        selected_columns=["count"],
    )
    assert result in builder.where
