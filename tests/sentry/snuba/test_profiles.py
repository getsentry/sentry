from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import pytest
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op, Or
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.profiles import (
    ProfilesQueryBuilder,
    ProfilesTimeseriesQueryBuilder,
)
from sentry.search.events.datasets.profiles import COLUMNS as PROFILE_COLUMNS
from sentry.search.events.datasets.profiles import ProfilesDatasetConfig
from sentry.snuba.dataset import Dataset
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all

# pin a timestamp for now so tests results dont change
now = datetime(2022, 10, 31, 0, 0, tzinfo=timezone.utc)
today = now.replace(hour=0, minute=0, second=0, microsecond=0)


@pytest.fixture
def params():
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


QUERY_BUILDER_FNS: list[tuple[str, Callable[..., BaseQueryBuilder]]] = [
    ("ProfilesQueryBuilder", ProfilesQueryBuilder),
    (
        "ProfilesTimeseriesQueryBuilder",
        lambda **kwargs: ProfilesTimeseriesQueryBuilder(interval=60, **kwargs),
    ),
]

FIELD_RESOLUTION_CASES = [(column.alias, column.column) for column in PROFILE_COLUMNS]

AGGREGATE_RESOLUTION_CASES = [
    ("last_seen()", Function("max", parameters=[Column("received")], alias="last_seen")),
    (
        "latest_event()",
        Function(
            "argMax",
            parameters=[Column("profile_id"), Column("received")],
            alias="latest_event",
        ),
    ),
    ("count()", Function("count", parameters=[], alias="count")),
    (
        "count_unique(transaction)",
        Function("uniq", parameters=[Column("transaction_name")], alias="count_unique_transaction"),
    ),
    (
        "percentile(profile.duration,0.25)",
        Function(
            "quantile(0.25)",
            parameters=[Column("duration_ns")],
            alias="percentile_profile_duration_0_25",
        ),
    ),
    *[
        (
            f"p{qt}()",
            Function(
                f"quantile(0.{qt.rstrip('0')})",
                parameters=[Column("duration_ns")],
                alias=f"p{qt}",
            ),
        )
        for qt in ["50", "75", "95", "99"]
    ],
    (
        "p100()",
        Function(
            "max",
            parameters=[Column("duration_ns")],
            alias="p100",
        ),
    ),
    *[
        (
            f"p{qt}(profile.duration)",
            Function(
                f"quantile(0.{qt.rstrip('0')})",
                parameters=[Column("duration_ns")],
                alias=f"p{qt}_profile_duration",
            ),
        )
        for qt in ["50", "75", "95", "99"]
    ],
    (
        "p100(profile.duration)",
        Function(
            "max",
            parameters=[Column("duration_ns")],
            alias="p100_profile_duration",
        ),
    ),
    *[
        (
            f"{fn}(profile.duration)",
            Function(
                fn,
                parameters=[Column("duration_ns")],
                alias=f"{fn}_profile_duration",
            ),
        )
        for fn in ["min", "max", "avg", "sum"]
    ],
]

INVALID_FIELD_RESOLUTION_CASES = [
    ("foo", "Unknown field: foo"),
    ("count(id)", "count: expected 0 argument\\(s\\)"),
    ("count_unique(foo)", "count_unique: column argument invalid: foo is not a valid column"),
    *[
        (f"p{qt}(foo)", f"p{qt}: column argument invalid: foo is not a valid column")
        for qt in ["50", "75", "95", "99"]
    ],
    *[
        (f"p{qt}(id)", f"p{qt}: column argument invalid: id is not a numeric column")
        for qt in ["50", "75", "95", "99"]
    ],
    ("percentile(foo,0.25)", "percentile: column argument invalid: foo is not a valid column"),
    ("percentile(id,0.25)", "percentile: column argument invalid: id is not a numeric column"),
    *[
        (f"{fn}(foo)", f"{fn}: column argument invalid: foo is not a valid column")
        for fn in ["min", "max", "avg", "sum"]
    ],
    *[
        (f"{fn}(id)", f"{fn}: column argument invalid: id is not a numeric column")
        for fn in ["min", "max", "avg", "sum"]
    ],
]


# The cases below only build queries, so they share one `params` setup through subtests.
@django_db_all
def test_field_resolution(params, subtests: pytest.Subtests) -> None:
    for builder_name, query_builder_fn in QUERY_BUILDER_FNS:
        for field, resolved in FIELD_RESOLUTION_CASES:
            with subtests.test(msg=field, query_builder=builder_name):
                builder = query_builder_fn(
                    dataset=Dataset.Profiles,
                    params=params,
                    selected_columns=[field],
                )
                if field == resolved:
                    assert builder.columns == [Column(field)]
                else:
                    assert builder.columns == [AliasedExpression(Column(resolved), alias=field)]


@django_db_all
def test_aggregate_resolution(params, subtests: pytest.Subtests) -> None:
    for builder_name, query_builder_fn in QUERY_BUILDER_FNS:
        for field, resolved in AGGREGATE_RESOLUTION_CASES:
            with subtests.test(msg=field, query_builder=builder_name):
                builder = query_builder_fn(
                    dataset=Dataset.Profiles,
                    params=params,
                    selected_columns=[field],
                )
                assert builder.columns == [resolved]


@django_db_all
def test_invalid_field_resolution(params, subtests: pytest.Subtests) -> None:
    for builder_name, query_builder_fn in QUERY_BUILDER_FNS:
        for field, message in INVALID_FIELD_RESOLUTION_CASES:
            with subtests.test(msg=field, query_builder=builder_name):
                with pytest.raises(InvalidSearchQuery, match=message):
                    query_builder_fn(
                        dataset=Dataset.Profiles,
                        params=params,
                        selected_columns=[field],
                    )


def is_null(column: str) -> Function:
    return Function("isNull", parameters=[Column(column)])


WHERE_RESOLUTION_CASES = [
    ("project.id:1", [Condition(Column("project_id"), Op.EQ, 1.0)]),
    ("!project.id:1", [Condition(Column("project_id"), Op.NEQ, 1.0)]),
    (f"trace.transaction:{'a' * 32}", [Condition(Column("transaction_id"), Op.EQ, "a" * 32)]),
    (f"!trace.transaction:{'a' * 32}", [Condition(Column("transaction_id"), Op.NEQ, "a" * 32)]),
    (f"id:{'a' * 32}", [Condition(Column("profile_id"), Op.EQ, "a" * 32)]),
    (f"!id:{'a' * 32}", [Condition(Column("profile_id"), Op.NEQ, "a" * 32)]),
    (
        f"timestamp:{today.isoformat()}",
        [
            # filtering for a timestamp means we search for a window around it
            Condition(Column("received"), Op.GTE, today - timedelta(minutes=5)),
            Condition(Column("received"), Op.LT, today + timedelta(minutes=6)),
        ],
    ),
    ("device.arch:x86_64", [Condition(Column("architecture"), Op.EQ, "x86_64")]),
    ("!device.arch:x86_64", [Condition(Column("architecture"), Op.NEQ, "x86_64")]),
    ("device.classification:high", [Condition(Column("device_classification"), Op.EQ, "high")]),
    ("!device.classification:high", [Condition(Column("device_classification"), Op.NEQ, "high")]),
    ("device.locale:en_US", [Condition(Column("device_locale"), Op.EQ, "en_US")]),
    ("!device.locale:en_US", [Condition(Column("device_locale"), Op.NEQ, "en_US")]),
    ("device.manufacturer:Apple", [Condition(Column("device_manufacturer"), Op.EQ, "Apple")]),
    ("!device.manufacturer:Apple", [Condition(Column("device_manufacturer"), Op.NEQ, "Apple")]),
    ("device.model:iPhone14,2", [Condition(Column("device_model"), Op.EQ, "iPhone14,2")]),
    ("!device.model:iPhone14,2", [Condition(Column("device_model"), Op.NEQ, "iPhone14,2")]),
    ("device.model:iPhone14,2", [Condition(Column("device_model"), Op.EQ, "iPhone14,2")]),
    ("os.build:20G817", [Condition(Column("device_os_build_number"), Op.EQ, "20G817")]),
    (
        "!os.build:20G817",
        [
            # os.build is a nullable column
            Or(
                conditions=[
                    Condition(is_null("device_os_build_number"), Op.EQ, 1),
                    Condition(Column("device_os_build_number"), Op.NEQ, "20G817"),
                ]
            )
        ],
    ),
    ("os.name:iOS", [Condition(Column("device_os_name"), Op.EQ, "iOS")]),
    ("!os.name:iOS", [Condition(Column("device_os_name"), Op.NEQ, "iOS")]),
    ("os.version:15.2", [Condition(Column("device_os_version"), Op.EQ, "15.2")]),
    ("!os.version:15.2", [Condition(Column("device_os_version"), Op.NEQ, "15.2")]),
    (
        "profile.duration:1",
        # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
        [Condition(Column("duration_ns"), Op.EQ, 1e6)],
    ),
    (
        "!profile.duration:1",
        # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
        [Condition(Column("duration_ns"), Op.NEQ, 1e6)],
    ),
    (
        "profile.duration:>1",
        # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
        [Condition(Column("duration_ns"), Op.GT, 1e6)],
    ),
    (
        "profile.duration:<1",
        # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
        [Condition(Column("duration_ns"), Op.LT, 1e6)],
    ),
    (
        "profile.duration:1s",
        # since 1s mean 1 second, and converted to nanoseconds its 1e9
        [Condition(Column("duration_ns"), Op.EQ, 1e9)],
    ),
    ("environment:dev", [Condition(Column("environment"), Op.EQ, "dev")]),
    (
        "!environment:dev",
        [
            # environment is a nullable column
            Or(
                conditions=[
                    Condition(is_null("environment"), Op.EQ, 1),
                    Condition(Column("environment"), Op.NEQ, "dev"),
                ]
            )
        ],
    ),
    ("platform.name:cocoa", [Condition(Column("platform"), Op.EQ, "cocoa")]),
    ("!platform.name:cocoa", [Condition(Column("platform"), Op.NEQ, "cocoa")]),
    (f"trace:{'a' * 32}", [Condition(Column("trace_id"), Op.EQ, "a" * 32)]),
    (f"!trace:{'a' * 32}", [Condition(Column("trace_id"), Op.NEQ, "a" * 32)]),
    ("transaction:foo", [Condition(Column("transaction_name"), Op.EQ, "foo")]),
    ("!transaction:foo", [Condition(Column("transaction_name"), Op.NEQ, "foo")]),
    ("release:foo", [Condition(Column("version_name"), Op.EQ, "foo")]),
    ("!release:foo", [Condition(Column("version_name"), Op.NEQ, "foo")]),
    ("project_id:1", [Condition(Column("project_id"), Op.EQ, 1)]),
    ("!project_id:1", [Condition(Column("project_id"), Op.NEQ, 1)]),
    (
        "foo",
        [
            Condition(
                Function("positionCaseInsensitive", [Column("transaction_name"), "foo"]),
                Op.NEQ,
                0,
            )
        ],
    ),
]


@django_db_all
def test_where_resolution(params, subtests: pytest.Subtests) -> None:
    for query, conditions in WHERE_RESOLUTION_CASES:
        with subtests.test(msg=query):
            builder = ProfilesQueryBuilder(
                dataset=Dataset.Profiles,
                params=params,
                selected_columns=["count()"],
                query=query,
            )

            for condition in conditions:
                assert condition in builder.where, condition


@pytest.mark.xfail(reason="date filters cannot negated")
@django_db_all
def test_where_resolution_negated_timestamp(params) -> None:
    ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=["count()"],
        query=f"!timestamp:{today.isoformat()}",
    )


@pytest.mark.parametrize("field", [pytest.param("project"), pytest.param("project.name")])
@django_db_all
def test_where_resolution_project_slug(params, field) -> None:
    project = params["project_objects"][0]

    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=["count()"],
        query=f"{field}:{project.slug}",
    )
    assert Condition(Column("project_id"), Op.EQ, project.id) in builder.where

    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=["count()"],
        query=f"!{field}:{project.slug}",
    )
    assert Condition(Column("project_id"), Op.NEQ, project.id) in builder.where


@pytest.mark.parametrize("field", [pytest.param("project"), pytest.param("project.name")])
@pytest.mark.parametrize("direction", [pytest.param("", id="asc"), pytest.param("-", id="desc")])
@django_db_all
def test_order_by_resolution_project_slug(params, field, direction) -> None:
    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=[field, "count()"],
        orderby=f"{direction}{field}",
    )

    assert (
        OrderBy(
            Function(
                "transform",
                [
                    Column("project_id"),
                    [project.id for project in params["project_objects"]],
                    [project.slug for project in params["project_objects"]],
                    "",
                ],
            ),
            Direction.ASC if direction == "" else Direction.DESC,
        )
        in builder.orderby
    )


@pytest.mark.parametrize(
    "field,column",
    [
        pytest.param(
            column.alias,
            column.column,
            id=f"has:{column.alias}",
            marks=pytest.mark.skip(reason="has not working yet"),
        )
        for column in PROFILE_COLUMNS
    ],
)
@django_db_all
def test_has_resolution(params, field, column) -> None:
    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=["count()"],
        query=f"has:{field}",
    )
    if field in ProfilesDatasetConfig.non_nullable_keys:
        assert Condition(Column(column), Op.NEQ, "") in builder.where
    else:
        assert Condition(is_null(column), Op.NEQ, 1) in builder.where


@pytest.mark.parametrize(
    "field,column",
    [
        pytest.param(
            column.alias,
            column.column,
            id=f"!has:{column.alias}",
            marks=pytest.mark.skip(reason="!has not working yet"),
        )
        for column in PROFILE_COLUMNS
    ],
)
@django_db_all
def test_not_has_resolution(params, field, column) -> None:
    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=["count()"],
        query=f"!has:{field}",
    )
    if field in ProfilesDatasetConfig.non_nullable_keys:
        assert Condition(Column(column), Op.EQ, "") in builder.where
    else:
        assert Condition(is_null(column), Op.EQ, 1) in builder.where
