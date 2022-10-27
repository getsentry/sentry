from datetime import datetime, timedelta

import pytest
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.function import Function

from sentry.snuba.profiles import ProfilesQueryBuilder
from sentry.testutils.factories import Factories
from sentry.utils.snuba import Dataset


@pytest.fixture
def params():
    organization = Factories.create_organization()
    team = Factories.create_team(organization=organization)
    project = Factories.create_project(organization=organization, teams=[team])

    user = Factories.create_user()
    Factories.create_team_membership(team=team, user=user)

    now = datetime.utcnow()

    return {
        "start": now - timedelta(seconds=2),
        "end": now - timedelta(seconds=1),
        "project_id": [project.id],
        "project_objects": [project],
        "organization_id": organization.id,
        "user_id": user.id,
        "team_id": [team.id],
    }


@pytest.mark.parametrize(
    "column,resolved",
    [
        pytest.param(
            "organization.id",
            AliasedExpression(Column("organization_id"), alias="organization.id"),
            id="organization.id",
        ),
        pytest.param(
            "project.id",
            AliasedExpression(Column("project_id"), alias="project.id"),
            id="project_id",
        ),
        pytest.param(
            "trace.transaction",
            AliasedExpression(Column("transaction_id"), alias="trace.transaction"),
            id="trace.transaction",
        ),
        pytest.param(
            "id",
            AliasedExpression(Column("profile_id"), alias="id"),
            id="id",
        ),
        pytest.param(
            "timestamp",
            AliasedExpression(Column("received"), alias="timestamp"),
            id="timestamp",
        ),
        pytest.param(
            "device.arch",
            AliasedExpression(Column("architecture"), alias="device.arch"),
            id="device.arch",
        ),
        pytest.param(
            "device.classification",
            AliasedExpression(Column("device_classification"), alias="device.classification"),
            id="device.classification",
        ),
        pytest.param(
            "device.locale",
            AliasedExpression(Column("device_locale"), alias="device.locale"),
            id="device.locale",
        ),
        pytest.param(
            "device.manufacturer",
            AliasedExpression(Column("device_manufacturer"), alias="device.manufacturer"),
            id="device.manufacturer",
        ),
        pytest.param(
            "device.model",
            AliasedExpression(Column("device_model"), alias="device.model"),
            id="device.model",
        ),
        pytest.param(
            "os.build",
            AliasedExpression(Column("device_os_build_number"), alias="os.build"),
            id="os.build",
        ),
        pytest.param(
            "os.name",
            AliasedExpression(Column("device_os_name"), alias="os.name"),
            id="os.name",
        ),
        pytest.param(
            "os.version",
            AliasedExpression(Column("device_os_version"), alias="os.version"),
            id="os.version",
        ),
        pytest.param(
            "profile.duration",
            AliasedExpression(Column("duration_ns"), alias="profile.duration"),
            id="profile.duration",
        ),
        pytest.param("environment", Column("environment"), id="environment"),
        pytest.param(
            "platform.name",
            AliasedExpression(Column("platform"), alias="platform.name"),
            id="platform.name",
        ),
        pytest.param(
            "trace",
            AliasedExpression(Column("trace_id"), alias="trace"),
            id="trace",
        ),
        pytest.param(
            "transaction",
            AliasedExpression(Column("transaction_name"), alias="transaction"),
            id="transaction",
        ),
        pytest.param(
            "release",
            AliasedExpression(Column("version_name"), alias="release"),
            id="release",
        ),
        pytest.param("project_id", Column("project_id"), id="project_id"),
        pytest.param(
            "project",
            AliasedExpression(Column("project_id"), alias="project"),
            id="project",
        ),
        pytest.param(
            "project.name",
            AliasedExpression(Column("project_id"), alias="project.name"),
            id="project.name",
        ),
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
            "count_unique(project)",
            Function("uniq", parameters=[Column("project_id")], alias="count_unique_project"),
            id="count_unique(project)",
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
        pytest.param(
            "p50()",
            Function(
                "quantile(0.5)",
                parameters=[Column("duration_ns")],
                alias="p50",
            ),
            id="p50()",
        ),
        pytest.param(
            "p75()",
            Function(
                "quantile(0.75)",
                parameters=[Column("duration_ns")],
                alias="p75",
            ),
            id="p75()",
        ),
        pytest.param(
            "p95()",
            Function(
                "quantile(0.95)",
                parameters=[Column("duration_ns")],
                alias="p95",
            ),
            id="p95()",
        ),
        pytest.param(
            "p99()",
            Function(
                "quantile(0.99)",
                parameters=[Column("duration_ns")],
                alias="p99",
            ),
            id="p99()",
        ),
        pytest.param(
            "p100()",
            Function(
                "max",
                parameters=[Column("duration_ns")],
                alias="p100",
            ),
            id="p100()",
        ),
        pytest.param(
            "p50(profile.duration)",
            Function(
                "quantile(0.5)",
                parameters=[Column("duration_ns")],
                alias="p50_profile_duration",
            ),
            id="p50(profile.duration)",
        ),
        pytest.param(
            "p75(profile.duration)",
            Function(
                "quantile(0.75)",
                parameters=[Column("duration_ns")],
                alias="p75_profile_duration",
            ),
            id="p75(profile.duration)",
        ),
        pytest.param(
            "p95(profile.duration)",
            Function(
                "quantile(0.95)",
                parameters=[Column("duration_ns")],
                alias="p95_profile_duration",
            ),
            id="p95(profile.duration)",
        ),
        pytest.param(
            "p99(profile.duration)",
            Function(
                "quantile(0.99)",
                parameters=[Column("duration_ns")],
                alias="p99_profile_duration",
            ),
            id="p99(profile.duration)",
        ),
        pytest.param(
            "p100(profile.duration)",
            Function(
                "max",
                parameters=[Column("duration_ns")],
                alias="p100_profile_duration",
            ),
            id="p100(profile.duration)",
        ),
        pytest.param(
            "min(profile.duration)",
            Function(
                "min",
                parameters=[Column("duration_ns")],
                alias="min_profile_duration",
            ),
            id="min(profile.duration)",
        ),
        pytest.param(
            "max(profile.duration)",
            Function(
                "max",
                parameters=[Column("duration_ns")],
                alias="max_profile_duration",
            ),
            id="max(profile.duration)",
        ),
        pytest.param(
            "avg(profile.duration)",
            Function(
                "avg",
                parameters=[Column("duration_ns")],
                alias="avg_profile_duration",
            ),
            id="avg(profile.duration)",
        ),
        pytest.param(
            "sum(profile.duration)",
            Function(
                "sum",
                parameters=[Column("duration_ns")],
                alias="sum_profile_duration",
            ),
            id="sum(profile.duration)",
        ),
    ],
)
@pytest.mark.django_db
def test_field_resolution(params, column, resolved):
    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        selected_columns=[column],
    )
    assert builder.columns == [resolved]
