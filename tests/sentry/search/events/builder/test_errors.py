from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from snuba_sdk import Entity, Join, Relationship
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function

from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.errors import PARSER_CONFIG_OVERRIDES
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class ErrorsQueryBuilderTest(TestCase):
    def setUp(self) -> None:
        self.projects = [self.project.id]

    @pytest.mark.querybuilder
    def test_simple_query(self) -> None:
        query = ErrorsQueryBuilder(
            dataset=Dataset.Events,
            query="status:unresolved",
            selected_columns=["count_unique(user)"],
            params={
                "project_id": self.projects,
            },
            offset=None,
            limit=None,
            config=QueryBuilderConfig(
                skip_time_conditions=True,
            ),
        ).get_snql_query()
        query.validate()
        e_entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        g_entity = Entity("group_attributes", alias="ga")

        assert query.query.match == Join([Relationship(e_entity, "attributes", g_entity)])
        assert query.query.select == [
            Function(
                function="uniq",
                parameters=[Column(name="tags[sentry:user]", entity=e_entity)],
                alias="count_unique_user",
            )
        ]
        assert query.query.where == [
            Condition(Column("group_status", entity=g_entity), Op.IN, [0]),
            Condition(
                Column("project_id", entity=Entity("events", alias="events")),
                Op.IN,
                self.projects,
            ),
            Condition(
                Column("project_id", entity=g_entity),
                Op.IN,
                self.projects,
            ),
        ]

    def test_upsampled_count_legacy_discover_function(self) -> None:
        """Test that the legacy DiscoverFunction for upsampled_count() produces the correct aggregate expression"""
        from sentry.search.events.fields import resolve_field

        # Test the legacy path that goes through DiscoverFunction.aggregate
        # This tests the aggregate field we fixed: ["toInt64(sum(ifNull(sample_weight, 1)))", None, None]
        resolved = resolve_field("upsampled_count()")

        # Should return a ResolvedFunction with the correct aggregate
        assert resolved.aggregate is not None
        assert len(resolved.aggregate) == 3

        # Position 0: The full SNQL function expression matching the helper method
        assert resolved.aggregate[0] == "toInt64(sum(ifNull(sample_weight, 1)))"

        # Position 1: Column (None for upsampled_count as it uses a fixed column)
        assert resolved.aggregate[1] is None

        # Position 2: Alias
        assert resolved.aggregate[2] == "upsampled_count"

    def test_is_status_simple_query(self) -> None:
        query = ErrorsQueryBuilder(
            dataset=Dataset.Events,
            query="is:unresolved",
            selected_columns=["count_unique(user)"],
            params={
                "project_id": self.projects,
            },
            offset=None,
            limit=None,
            config=QueryBuilderConfig(
                skip_time_conditions=True,
                parser_config_overrides=PARSER_CONFIG_OVERRIDES,
            ),
        ).get_snql_query()
        query.validate()
        e_entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        g_entity = Entity("group_attributes", alias="ga")

        assert query.query.match == Join([Relationship(e_entity, "attributes", g_entity)])
        assert query.query.select == [
            Function(
                function="uniq",
                parameters=[Column(name="tags[sentry:user]", entity=e_entity)],
                alias="count_unique_user",
            )
        ]
        assert query.query.where == [
            Condition(Column("group_status", entity=g_entity), Op.IN, [0]),
            Condition(
                Column("project_id", entity=Entity("events", alias="events")),
                Op.IN,
                self.projects,
            ),
            Condition(
                Column("project_id", entity=g_entity),
                Op.IN,
                self.projects,
            ),
        ]

    def test_error_received_filter_uses_datetime(self) -> None:
        """Test that error.received filter uses datetime comparison, not epoch integer."""
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=1)
        end = now
        filter_date = now - timedelta(hours=12)

        query = ErrorsQueryBuilder(
            dataset=Dataset.Events,
            query=f"error.received:>{filter_date.isoformat()}",
            selected_columns=["count()"],
            params={
                "project_id": self.projects,
            },
            snuba_params=SnubaParams(
                start=start,
                end=end,
                projects=[self.project],
                organization=self.organization,
            ),
            offset=None,
            limit=None,
            config=QueryBuilderConfig(),
        ).get_snql_query()
        query.validate()

        # Find the error.received condition in the where clause
        received_conditions = [
            c
            for c in query.query.where
            if isinstance(c, Condition) and isinstance(c.lhs, Column) and c.lhs.name == "received"
        ]

        assert len(received_conditions) == 1, "Should have exactly one error.received condition"
        received_condition = received_conditions[0]

        # Verify the condition uses datetime comparison, not epoch integer
        assert received_condition.op == Op.GT
        # The RHS should be a datetime or datetime-formatted Function, not an integer
        assert not isinstance(
            received_condition.rhs, int
        ), "error.received should compare against datetime, not epoch integer"
