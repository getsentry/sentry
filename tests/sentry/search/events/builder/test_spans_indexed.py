from datetime import datetime, timedelta, timezone

import pytest
from snuba_sdk import AliasedExpression, Column

from sentry.search.events.builder.spans_indexed import SpansEAPQueryBuilder
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
    ["attribute", "expected"],
    [
        pytest.param(
            "id",
            AliasedExpression(Column("span_id"), alias="id"),
            id="id",
        ),
        pytest.param("span_id", Column("span_id"), id="span_id"),
        pytest.param(
            "parent_span",
            AliasedExpression(Column("parent_span_id"), alias="parent_span"),
            id="parent_span",
        ),
        pytest.param(
            "organization.id",
            AliasedExpression(Column("organization_id"), alias="organization.id"),
            id="organization.id",
        ),
        pytest.param(
            "project",
            AliasedExpression(Column("project_id"), alias="project"),
            id="project",
        ),
        pytest.param(
            "project.id",
            AliasedExpression(Column("project_id"), alias="project.id"),
            id="project.id",
        ),
        pytest.param("project_id", Column("project_id"), id="project_id"),
        pytest.param(
            "span.action",
            AliasedExpression(Column("attr_str[sentry.action]"), alias="span.action"),
            id="span.action",
        ),
        pytest.param(
            "span.description",
            AliasedExpression(Column("name"), alias="span.description"),
            id="span.description",
        ),
        pytest.param(
            "description",
            AliasedExpression(Column("name"), alias="description"),
            id="description",
        ),
        pytest.param(
            "message",
            AliasedExpression(Column("name"), alias="message"),
            id="message",
        ),
        pytest.param("sampling_weight", Column("sampling_weight"), id="sampling_weight"),
        pytest.param("sampling_factor", Column("sampling_factor"), id="sampling_factor"),
        pytest.param(
            "span.domain",
            AliasedExpression(Column("attr_str[sentry.domain]"), alias="span.domain"),
            id="span.domain",
        ),
        pytest.param(
            "span.group",
            AliasedExpression(Column("attr_str[sentry.group]"), alias="span.group"),
            id="span.group",
        ),
        pytest.param(
            "span.op",
            AliasedExpression(Column("attr_str[sentry.op]"), alias="span.op"),
            id="span.op",
        ),
        pytest.param(
            "span.category",
            AliasedExpression(Column("attr_str[sentry.category]"), alias="span.category"),
            id="span.category",
        ),
        pytest.param(
            "span.self_time",
            AliasedExpression(Column("exclusive_time_ms"), alias="span.self_time"),
            id="span.self_time",
        ),
        pytest.param(
            "span.status",
            AliasedExpression(Column("attr_str[sentry.status]"), alias="span.status"),
            id="span.status",
        ),
        pytest.param("timestamp", Column("timestamp"), id="timestamp"),
        pytest.param(
            "trace",
            AliasedExpression(Column("trace_id"), alias="trace"),
            id="trace",
        ),
        pytest.param(
            "transaction",
            AliasedExpression(Column("segment_name"), alias="transaction"),
            id="transaction",
        ),
        pytest.param(
            "transaction.span_id",
            AliasedExpression(Column("segment_id"), alias="transaction.span_id"),
            id="transaction.span_id",
        ),
        pytest.param(
            "transaction.method",
            AliasedExpression(
                Column("attr_str[sentry.transaction.method]"), alias="transaction.method"
            ),
            id="transaction.method",
        ),
        pytest.param(
            "is_transaction",
            AliasedExpression(Column("is_segment"), alias="is_transaction"),
            id="is_transaction",
        ),
        pytest.param(
            "segment.id",
            AliasedExpression(Column("segment_id"), alias="segment.id"),
            id="segment.id",
        ),
        pytest.param(
            "origin.transaction",
            AliasedExpression(Column("segment_name"), alias="origin.transaction"),
            id="origin.transaction",
        ),
        pytest.param(
            "messaging.destination.name",
            AliasedExpression(
                Column("attr_str[sentry.messaging.destination.name]"),
                alias="messaging.destination.name",
            ),
            id="messaging.destination.name",
        ),
        pytest.param(
            "messaging.message.id",
            AliasedExpression(
                Column("attr_str[sentry.messaging.message.id]"), alias="messaging.message.id"
            ),
            id="messaging.message.id",
        ),
        pytest.param(
            "span.status_code",
            AliasedExpression(Column("attr_str[sentry.status_code]"), alias="span.status_code"),
            id="span.status_code",
        ),
        pytest.param(
            "replay.id",
            AliasedExpression(Column("attr_str[sentry.replay_id]"), alias="replay.id"),
            id="replay.id",
        ),
        pytest.param(
            "span.ai.pipeline.group",
            AliasedExpression(
                Column("attr_str[sentry.ai_pipeline_group]"), alias="span.ai.pipeline.group"
            ),
            id="span.ai.pipeline.group",
        ),
        pytest.param(
            "trace.status",
            AliasedExpression(Column("attr_str[sentry.trace.status]"), alias="trace.status"),
            id="trace.status",
        ),
        pytest.param(
            "browser.name",
            AliasedExpression(Column("attr_str[sentry.browser.name]"), alias="browser.name"),
            id="browser.name",
        ),
        pytest.param(
            "ai.total_tokens.used",
            AliasedExpression(
                Column("attr_num[ai_total_tokens_used]"), alias="ai.total_tokens.used"
            ),
            id="ai.total_tokens.used",
        ),
        pytest.param(
            "ai.total_cost",
            AliasedExpression(Column("attr_num[ai_total_cost]"), alias="ai.total_cost"),
            id="ai.total_cost",
        ),
    ],
)
@django_db_all
def test_eap_attributes(params, attribute, expected) -> None:
    builder = SpansEAPQueryBuilder(
        Dataset.EventsAnalyticsPlatform,
        params,
        selected_columns=[attribute],
    )
    assert expected in builder.columns
