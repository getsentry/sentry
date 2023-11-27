from __future__ import annotations

import pytest
from snuba_sdk import Entity, Join, Relationship
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function

from sentry.search.events.builder import ErrorsQueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.errors import PARSER_CONFIG_OVERRIDES
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class ErrorsQueryBuilderTest(TestCase):
    def setUp(self):
        self.projects = [self.project.id]

    def test_simple_query(self):
        with self.feature("organizations:metric-alert-ignore-archived"):
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

    def test_is_status_simple_query(self):
        with self.feature("organizations:metric-alert-ignore-archived"):
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
