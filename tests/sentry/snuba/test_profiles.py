from datetime import datetime, timedelta

import pytest
from django.utils import timezone
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op, Or
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy

from sentry.search.events.datasets.profiles import COLUMNS as PROFILE_COLUMNS
from sentry.search.events.datasets.profiles import ProfilesDatasetConfig
from sentry.search.events.fields import InvalidSearchQuery
from sentry.snuba.profiles import ProfilesQueryBuilder, ProfilesTimeseriesQueryBuilder
from sentry.testutils.factories import Factories
from sentry.utils.snuba import Dataset

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


def query_builder_fns(arg_name="query_builder_fn"):
    return pytest.mark.parametrize(
        arg_name,
        [
            pytest.param(ProfilesQueryBuilder, id="ProfilesQueryBuilder"),
            pytest.param(
                lambda **kwargs: ProfilesTimeseriesQueryBuilder(interval=60, **kwargs),
                id="ProfilesTimeseriesQueryBuilder",
            ),
        ],
    )


@pytest.mark.parametrize(
    "field,resolved",
    [pytest.param(column.alias, column.column, id=column.alias) for column in PROFILE_COLUMNS],
)
@query_builder_fns()
@pytest.mark.django_db
def test_field_resolution(query_builder_fn, params, field, resolved):
    builder = query_builder_fn(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=[field],
    )
    if field == resolved:
        assert builder.columns == [Column(field)]
    else:
        assert builder.columns == [AliasedExpression(Column(resolved), alias=field)]


@pytest.mark.parametrize(
    "field,resolved",
    [
        pytest.param(
            "last_seen()",
            Function("max", parameters=[Column("received")], alias="last_seen"),
            id="last_seen()",
        ),
        pytest.param(
            "latest_event()",
            Function(
                "argMax",
                parameters=[Column("profile_id"), Column("received")],
                alias="latest_event",
            ),
            id="latest_event()",
        ),
        pytest.param("count()", Function("count", parameters=[], alias="count"), id="count()"),
        pytest.param(
            "count_unique(transaction)",
            Function(
                "uniq", parameters=[Column("transaction_name")], alias="count_unique_transaction"
            ),
            id="count_unique(transaction)",
        ),
        pytest.param(
            "percentile(profile.duration,0.25)",
            Function(
                "quantile(0.25)",
                parameters=[Column("duration_ns")],
                alias="percentile_profile_duration_0_25",
            ),
            id="percentile(profile.duration,0.25)",
        ),
        *[
            pytest.param(
                f"p{qt}()",
                Function(
                    f"quantile(0.{qt.rstrip('0')})",
                    parameters=[Column("duration_ns")],
                    alias=f"p{qt}",
                ),
                id=f"p{qt}()",
            )
            for qt in ["50", "75", "95", "99"]
        ],
        pytest.param(
            "p100()",
            Function(
                "max",
                parameters=[Column("duration_ns")],
                alias="p100",
            ),
            id="p100()",
        ),
        *[
            pytest.param(
                f"p{qt}(profile.duration)",
                Function(
                    f"quantile(0.{qt.rstrip('0')})",
                    parameters=[Column("duration_ns")],
                    alias=f"p{qt}_profile_duration",
                ),
                id=f"p{qt}(profile.duration)",
            )
            for qt in ["50", "75", "95", "99"]
        ],
        pytest.param(
            "p100(profile.duration)",
            Function(
                "max",
                parameters=[Column("duration_ns")],
                alias="p100_profile_duration",
            ),
            id="p100(profile.duration)",
        ),
        *[
            pytest.param(
                f"{fn}(profile.duration)",
                Function(
                    fn,
                    parameters=[Column("duration_ns")],
                    alias=f"{fn}_profile_duration",
                ),
                id=f"{fn}(profile.duration)",
            )
            for fn in ["min", "max", "avg", "sum"]
        ],
    ],
)
@query_builder_fns()
@pytest.mark.django_db
def test_aggregate_resolution(query_builder_fn, params, field, resolved):
    builder = query_builder_fn(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=[field],
    )
    assert builder.columns == [resolved]


@pytest.mark.parametrize(
    "field,message",
    [
        pytest.param("foo", "Unknown field: foo", id="foo"),
        pytest.param("count(id)", "count: expected 0 argument\\(s\\)", id="count(id)"),
        pytest.param(
            "count_unique(foo)",
            "count_unique: column argument invalid: foo is not a valid column",
            id="count_unique(foo)",
        ),
        *[
            pytest.param(
                f"p{qt}(foo)",
                f"p{qt}: column argument invalid: foo is not a valid column",
                id=f"p{qt}(foo)",
            )
            for qt in ["50", "75", "95", "99"]
        ],
        *[
            pytest.param(
                f"p{qt}(id)",
                f"p{qt}: column argument invalid: id is not a numeric column",
                id=f"p{qt}(id)",
            )
            for qt in ["50", "75", "95", "99"]
        ],
        pytest.param(
            "percentile(foo,0.25)",
            "percentile: column argument invalid: foo is not a valid column",
            id="percentile(foo,0.25)",
        ),
        pytest.param(
            "percentile(id,0.25)",
            "percentile: column argument invalid: id is not a numeric column",
            id="percentile(id,0.25)",
        ),
        *[
            pytest.param(
                f"{fn}(foo)",
                f"{fn}: column argument invalid: foo is not a valid column",
                id=f"{fn}(foo)",
            )
            for fn in ["min", "max", "avg", "sum"]
        ],
        *[
            pytest.param(
                f"{fn}(id)",
                f"{fn}: column argument invalid: id is not a numeric column",
                id=f"{fn}(id)",
            )
            for fn in ["min", "max", "avg", "sum"]
        ],
    ],
)
@query_builder_fns()
@pytest.mark.django_db
def test_invalid_field_resolution(query_builder_fn, params, field, message):
    with pytest.raises(InvalidSearchQuery, match=message):
        query_builder_fn(
            dataset=Dataset.Profiles,
            params=params,
            selected_columns=[field],
        )


def is_null(column: str) -> Function:
    return Function("isNull", parameters=[Column(column)])


@pytest.mark.parametrize(
    "query,conditions",
    [
        pytest.param(
            "project.id:1", [Condition(Column("project_id"), Op.EQ, 1.0)], id="project.id:1"
        ),
        pytest.param(
            "!project.id:1",
            [Condition(Column("project_id"), Op.NEQ, 1.0)],
            id="!project.id:1",
        ),
        pytest.param(
            f"trace.transaction:{'a' * 32}",
            [Condition(Column("transaction_id"), Op.EQ, "a" * 32)],
            id=f"trace.transaction:{'a' * 32}",
        ),
        pytest.param(
            f"!trace.transaction:{'a' * 32}",
            [Condition(Column("transaction_id"), Op.NEQ, "a" * 32)],
            id=f"!trace.transaction:{'a' * 32}",
        ),
        pytest.param(
            f"id:{'a' * 32}",
            [Condition(Column("profile_id"), Op.EQ, "a" * 32)],
            id=f"id:{'a' * 32}",
        ),
        pytest.param(
            f"!id:{'a' * 32}",
            [Condition(Column("profile_id"), Op.NEQ, "a" * 32)],
            id=f"!id:{'a' * 32}",
        ),
        pytest.param(
            f"timestamp:{today.isoformat()}",
            [
                # filtering for a timestamp means we search for a window around it
                Condition(Column("received"), Op.GTE, today - timedelta(minutes=5)),
                Condition(Column("received"), Op.LT, today + timedelta(minutes=6)),
            ],
            id=f"timestamp:{today.isoformat()}",
        ),
        pytest.param(
            f"!timestamp:{today.isoformat()}",
            [],  # not sure what this should be yet
            id=f"!timestamp:{today.isoformat()}",
            marks=pytest.mark.xfail(reason="date filters cannot negated"),
        ),
        pytest.param(
            "device.arch:x86_64",
            [Condition(Column("architecture"), Op.EQ, "x86_64")],
            id="device.arch:x86_64",
        ),
        pytest.param(
            "!device.arch:x86_64",
            [Condition(Column("architecture"), Op.NEQ, "x86_64")],
            id="!device.arch:x86_64",
        ),
        pytest.param(
            "device.classification:high",
            [Condition(Column("device_classification"), Op.EQ, "high")],
            id="device.classification:high",
        ),
        pytest.param(
            "!device.classification:high",
            [Condition(Column("device_classification"), Op.NEQ, "high")],
            id="!device.classification:high",
        ),
        pytest.param(
            "device.locale:en_US",
            [Condition(Column("device_locale"), Op.EQ, "en_US")],
            id="device.locale:en_US",
        ),
        pytest.param(
            "!device.locale:en_US",
            [Condition(Column("device_locale"), Op.NEQ, "en_US")],
            id="!device.locale:en_US",
        ),
        pytest.param(
            "device.manufacturer:Apple",
            [Condition(Column("device_manufacturer"), Op.EQ, "Apple")],
            id="device.manufacturer:Apple",
        ),
        pytest.param(
            "!device.manufacturer:Apple",
            [Condition(Column("device_manufacturer"), Op.NEQ, "Apple")],
            id="!device.manufacturer:Apple",
        ),
        pytest.param(
            "device.model:iPhone14,2",
            [Condition(Column("device_model"), Op.EQ, "iPhone14,2")],
            id="device.model:iPhone14,2",
        ),
        pytest.param(
            "!device.model:iPhone14,2",
            [Condition(Column("device_model"), Op.NEQ, "iPhone14,2")],
            id="!device.model:iPhone14,2",
        ),
        pytest.param(
            "device.model:iPhone14,2",
            [Condition(Column("device_model"), Op.EQ, "iPhone14,2")],
            id="device.model:iPhone14,2",
        ),
        pytest.param(
            "os.build:20G817",
            [Condition(Column("device_os_build_number"), Op.EQ, "20G817")],
            id="os.build:20G817",
        ),
        pytest.param(
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
            id="!os.build:20G817",
        ),
        pytest.param(
            "os.name:iOS",
            [Condition(Column("device_os_name"), Op.EQ, "iOS")],
            id="os.name:iOS",
        ),
        pytest.param(
            "!os.name:iOS",
            [Condition(Column("device_os_name"), Op.NEQ, "iOS")],
            id="!os.name:iOS",
        ),
        pytest.param(
            "os.version:15.2",
            [Condition(Column("device_os_version"), Op.EQ, "15.2")],
            id="os.version:15.2",
        ),
        pytest.param(
            "!os.version:15.2",
            [Condition(Column("device_os_version"), Op.NEQ, "15.2")],
            id="!os.version:15.2",
        ),
        pytest.param(
            "profile.duration:1",
            # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
            [Condition(Column("duration_ns"), Op.EQ, 1e6)],
            id="profile.duration:1",
        ),
        pytest.param(
            "!profile.duration:1",
            # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
            [Condition(Column("duration_ns"), Op.NEQ, 1e6)],
            id="!profile.duration:1",
        ),
        pytest.param(
            "profile.duration:>1",
            # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
            [Condition(Column("duration_ns"), Op.GT, 1e6)],
            id="profile.duration:>1",
        ),
        pytest.param(
            "profile.duration:<1",
            # since 1 mean 1 millisecond, and converted to nanoseconds its 1e6
            [Condition(Column("duration_ns"), Op.LT, 1e6)],
            id="profile.duration:<1",
        ),
        pytest.param(
            "profile.duration:1s",
            # since 1s mean 1 second, and converted to nanoseconds its 1e9
            [Condition(Column("duration_ns"), Op.EQ, 1e9)],
            id="profile.duration:1s",
        ),
        pytest.param(
            "environment:dev",
            [Condition(Column("environment"), Op.EQ, "dev")],
            id="environment:dev",
        ),
        pytest.param(
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
            id="!environment:dev",
        ),
        pytest.param(
            "platform.name:cocoa",
            [Condition(Column("platform"), Op.EQ, "cocoa")],
            id="platform.name:cocoa",
        ),
        pytest.param(
            "!platform.name:cocoa",
            [Condition(Column("platform"), Op.NEQ, "cocoa")],
            id="!platform.name:cocoa",
        ),
        pytest.param(
            f"trace:{'a' * 32}",
            [Condition(Column("trace_id"), Op.EQ, "a" * 32)],
            id=f"trace:{'a' * 32}",
        ),
        pytest.param(
            f"!trace:{'a' * 32}",
            [Condition(Column("trace_id"), Op.NEQ, "a" * 32)],
            id=f"!trace:{'a' * 32}",
        ),
        pytest.param(
            "transaction:foo",
            [Condition(Column("transaction_name"), Op.EQ, "foo")],
            id="transaction:foo",
        ),
        pytest.param(
            "!transaction:foo",
            [Condition(Column("transaction_name"), Op.NEQ, "foo")],
            id="!transaction:foo",
        ),
        pytest.param(
            "release:foo",
            [Condition(Column("version_name"), Op.EQ, "foo")],
            id="release:foo",
        ),
        pytest.param(
            "!release:foo",
            [Condition(Column("version_name"), Op.NEQ, "foo")],
            id="!release:foo",
        ),
        pytest.param(
            "project_id:1",
            [Condition(Column("project_id"), Op.EQ, 1)],
            id="project_id:1",
        ),
        pytest.param(
            "!project_id:1",
            [Condition(Column("project_id"), Op.NEQ, 1)],
            id="!project_id:1",
        ),
    ],
)
@pytest.mark.django_db
def test_where_resolution(params, query, conditions):
    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=["count()"],
        query=query,
    )

    for condition in conditions:
        assert condition in builder.where, condition


@pytest.mark.parametrize("field", [pytest.param("project"), pytest.param("project.name")])
@pytest.mark.django_db
def test_where_resolution_project_slug(params, field):
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
@pytest.mark.django_db
def test_order_by_resolution_project_slug(params, field, direction):
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
@pytest.mark.django_db
def test_has_resolution(params, field, column):
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
@pytest.mark.django_db
def test_not_has_resolution(params, field, column):
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
