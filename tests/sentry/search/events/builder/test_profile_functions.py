from datetime import datetime, timedelta, timezone

import pytest
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function

from sentry.search.events.builder.profile_functions import ProfileFunctionsQueryBuilder
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


@pytest.mark.parametrize(
    "search,condition",
    [
        pytest.param(
            'package:""',
            Condition(Column("package"), Op("="), ""),
            id="empty package",
        ),
        pytest.param(
            '!package:""',
            Condition(Column("package"), Op("!="), ""),
            id="not empty package",
        ),
        pytest.param(
            'function:""',
            Condition(Column("name"), Op("="), ""),
            id="empty function",
        ),
        pytest.param(
            '!function:""',
            Condition(Column("name"), Op("!="), ""),
            id="not empty function",
        ),
        pytest.param(
            "fingerprint:123",
            Condition(Function("toUInt32", [Column("fingerprint")], "fingerprint"), Op("="), 123),
            id="fingerprint",
        ),
        pytest.param(
            "!fingerprint:123",
            Condition(Function("toUInt32", [Column("fingerprint")], "fingerprint"), Op("!="), 123),
            id="not fingerprint",
        ),
    ],
)
@django_db_all
def test_where(params, search, condition):
    builder = ProfileFunctionsQueryBuilder(
        Dataset.Functions,
        params,
        query=search,
        selected_columns=["count()"],
    )
    assert condition in builder.where
