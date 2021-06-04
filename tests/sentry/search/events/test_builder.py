import datetime
import unittest

from django.utils import timezone
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op, Or
from snuba_sdk.orderby import Direction, OrderBy

from sentry.search.events.builder import QueryBuilder
from sentry.utils.snuba import Dataset


class QueryBuilderTest(unittest.TestCase):
    def setUp(self):
        self.start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        self.end = datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)
        self.projects = [1, 2, 3]
        self.params = {
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }
        # These conditions should always be on a query when self.params is passed
        self.default_conditions = [
            Condition(Column("timestamp"), Op.GTE, self.start),
            Condition(Column("timestamp"), Op.LT, self.end),
            Condition(Column("project_id"), Op.IN, self.projects),
        ]

    def test_simple_query(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "user.email:foo@example.com release:1.2.1",
            ["user.email", "release"],
        )

        assert query.where == [
            Condition(Column("email"), Op.EQ, "foo@example.com"),
            Condition(Column("release"), Op.EQ, "1.2.1"),
            *self.default_conditions,
        ]
        assert query.select == [
            Column("email"),
            Column("release"),
        ]
        query.get_snql_query().validate()

    def test_simple_orderby(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            selected_columns=["user.email", "release"],
            orderby=["user.email"],
        )

        assert query.where == self.default_conditions
        assert query.orderby == [OrderBy(Column("email"), Direction.ASC)]
        query.get_snql_query().validate()

        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            selected_columns=["user.email", "release"],
            orderby=["-user.email"],
        )

        assert query.where == self.default_conditions
        assert query.orderby == [OrderBy(Column("email"), Direction.DESC)]
        query.get_snql_query().validate()

    def test_environment_filter(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "environment:prod",
            ["environment"],
        )

        assert query.where == [
            Condition(Column("environment"), Op.EQ, "prod"),
            *self.default_conditions,
        ]
        query.get_snql_query().validate()

        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "environment:[dev, prod]",
            ["environment"],
        )

        assert query.where == [
            Condition(Column("environment"), Op.IN, ["dev", "prod"]),
            *self.default_conditions,
        ]
        query.get_snql_query().validate()

    def test_environment_param(self):
        self.params["environment"] = ["", "prod"]
        query = QueryBuilder(Dataset.Discover, self.params, selected_columns=["environment"])

        assert query.where == [
            *self.default_conditions,
            Or(
                [
                    Condition(Column("environment"), Op.IS_NULL),
                    Condition(Column("environment"), Op.EQ, "prod"),
                ]
            ),
        ]
        query.get_snql_query().validate()

        self.params["environment"] = ["dev", "prod"]
        query = QueryBuilder(Dataset.Discover, self.params, selected_columns=["environment"])

        assert query.where == [
            *self.default_conditions,
            Condition(Column("environment"), Op.IN, ["dev", "prod"]),
        ]
        query.get_snql_query().validate()
