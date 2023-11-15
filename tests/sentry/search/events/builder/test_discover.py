from __future__ import annotations

import datetime
import re
from datetime import timezone
from typing import Any

import pytest
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op, Or
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.utils.snuba import QueryOutsideRetentionError
from sentry.utils.validators import INVALID_ID_DETAILS

pytestmark = pytest.mark.sentry_metrics


class QueryBuilderTest(TestCase):
    def setUp(self):
        self.start = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=15, second=0, microsecond=0
        ) - datetime.timedelta(days=2)
        self.end = self.start + datetime.timedelta(days=1)
        self.projects = [self.project.id, self.create_project().id, self.create_project().id]
        self.params: dict[str, Any] = {
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
            query="user.email:foo@example.com release:1.2.1",
            selected_columns=["user.email", "release"],
        )

        self.assertCountEqual(
            query.where,
            [
                Condition(Column("email"), Op.EQ, "foo@example.com"),
                Condition(Column("release"), Op.IN, ["1.2.1"]),
                *self.default_conditions,
            ],
        )
        self.assertCountEqual(
            query.columns,
            [
                AliasedExpression(Column("email"), "user.email"),
                Column("release"),
            ],
        )
        query.get_snql_query().validate()

    def test_simple_orderby(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            selected_columns=["user.email", "release"],
            orderby=["user.email"],
        )

        self.assertCountEqual(query.where, self.default_conditions)
        self.assertCountEqual(
            query.orderby,
            [OrderBy(Column("email"), Direction.ASC)],
        )
        query.get_snql_query().validate()

        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            selected_columns=["user.email", "release"],
            orderby=["-user.email"],
        )

        self.assertCountEqual(query.where, self.default_conditions)
        self.assertCountEqual(
            query.orderby,
            [OrderBy(Column("email"), Direction.DESC)],
        )
        query.get_snql_query().validate()

    def test_orderby_duplicate_columns(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            selected_columns=["user.email", "user.email"],
            orderby=["user.email"],
        )
        self.assertCountEqual(
            query.orderby,
            [OrderBy(Column("email"), Direction.ASC)],
        )

    def test_simple_limitby(self):
        query = QueryBuilder(
            dataset=Dataset.Discover,
            params=self.params,
            query="",
            selected_columns=["message"],
            orderby="message",
            limitby=("message", 1),
            limit=4,
        )

        assert query.limitby == LimitBy([Column("message")], 1)

    def test_environment_filter(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="environment:prod",
            selected_columns=["environment"],
        )

        self.assertCountEqual(
            query.where,
            [
                Condition(Column("environment"), Op.EQ, "prod"),
                *self.default_conditions,
            ],
        )
        query.get_snql_query().validate()

        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="environment:[dev, prod]",
            selected_columns=["environment"],
        )

        self.assertCountEqual(
            query.where,
            [
                Condition(Column("environment"), Op.IN, ["dev", "prod"]),
                *self.default_conditions,
            ],
        )
        query.get_snql_query().validate()

    def test_environment_param(self):
        self.params["environment"] = ["", self.environment.name]
        query = QueryBuilder(Dataset.Discover, self.params, selected_columns=["environment"])

        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                Or(
                    [
                        Condition(Column("environment"), Op.IS_NULL),
                        Condition(Column("environment"), Op.EQ, self.environment.name),
                    ]
                ),
            ],
        )
        query.get_snql_query().validate()

        env2 = self.create_environment()
        self.params["environment"] = [self.environment.name, env2.name]
        query = QueryBuilder(Dataset.Discover, self.params, selected_columns=["environment"])

        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                Condition(Column("environment"), Op.IN, sorted([self.environment.name, env2.name])),
            ],
        )
        query.get_snql_query().validate()

    def test_project_in_condition_filters(self):
        # TODO(snql-boolean): Update this to match the corresponding test in test_filter
        project1 = self.create_project()
        project2 = self.create_project()
        self.params["project_id"] = [project1.id, project2.id]
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query=f"project:{project1.slug}",
            selected_columns=["environment"],
        )

        self.assertCountEqual(
            query.where,
            [
                # generated by the search query on project
                Condition(Column("project_id"), Op.EQ, project1.id),
                Condition(Column("timestamp"), Op.GTE, self.start),
                Condition(Column("timestamp"), Op.LT, self.end),
                # default project filter from the params
                Condition(Column("project_id"), Op.IN, [project1.id, project2.id]),
            ],
        )

    def test_project_in_condition_filters_not_in_project_filter(self):
        # TODO(snql-boolean): Update this to match the corresponding test in test_filter
        project1 = self.create_project()
        project2 = self.create_project()
        # params is assumed to be validated at this point, so this query should be invalid
        self.params["project_id"] = [project2.id]
        with pytest.raises(
            InvalidSearchQuery,
            match=re.escape(
                f"Invalid query. Project(s) {str(project1.slug)} do not exist or are not actively selected."
            ),
        ):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query=f"project:{project1.slug}",
                selected_columns=["environment"],
            )

    def test_project_alias_column(self):
        # TODO(snql-boolean): Update this to match the corresponding test in test_filter
        project1 = self.create_project()
        project2 = self.create_project()
        self.params["project_id"] = [project1.id, project2.id]
        query = QueryBuilder(Dataset.Discover, self.params, selected_columns=["project"])

        self.assertCountEqual(
            query.where,
            [
                Condition(Column("project_id"), Op.IN, [project1.id, project2.id]),
                Condition(Column("timestamp"), Op.GTE, self.start),
                Condition(Column("timestamp"), Op.LT, self.end),
            ],
        )
        self.assertCountEqual(
            query.columns,
            [
                AliasedExpression(
                    Column("project_id"),
                    "project",
                )
            ],
        )

    def test_project_alias_column_with_project_condition(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.params["project_id"] = [project1.id, project2.id]
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query=f"project:{project1.slug}",
            selected_columns=["project"],
        )

        self.assertCountEqual(
            query.where,
            [
                # generated by the search query on project
                Condition(Column("project_id"), Op.EQ, project1.id),
                Condition(Column("timestamp"), Op.GTE, self.start),
                Condition(Column("timestamp"), Op.LT, self.end),
                # default project filter from the params
                Condition(Column("project_id"), Op.IN, [project1.id, project2.id]),
            ],
        )
        # Because of the condition on project there should only be 1 project in the transform
        self.assertCountEqual(
            query.columns,
            [
                AliasedExpression(
                    Column("project_id"),
                    "project",
                )
            ],
        )

    def test_orderby_project_alias(self):
        project1 = self.create_project(name="zzz")
        project2 = self.create_project(name="aaa")
        self.params["project_id"] = [project1.id, project2.id]
        query = QueryBuilder(
            Dataset.Discover, self.params, selected_columns=["project"], orderby=["project"]
        )

        self.assertCountEqual(
            query.orderby,
            [
                OrderBy(
                    Function(
                        "transform",
                        [
                            Column("project_id"),
                            [project1.id, project2.id],
                            [project1.slug, project2.slug],
                            "",
                        ],
                    ),
                    Direction.ASC,
                )
            ],
        )

    def test_count_if(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "count_if(event.type,equals,transaction)",
                'count_if(event.type,notEquals,"transaction")',
            ],
        )
        self.assertCountEqual(query.where, self.default_conditions)
        self.assertCountEqual(
            query.aggregates,
            [
                Function(
                    "countIf",
                    [
                        Function("equals", [Column("type"), "transaction"]),
                    ],
                    "count_if_event_type_equals_transaction",
                ),
                Function(
                    "countIf",
                    [
                        Function("notEquals", [Column("type"), "transaction"]),
                    ],
                    "count_if_event_type_notEquals__transaction",
                ),
            ],
        )

    def test_count_if_array(self):
        self.maxDiff = None
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "count_if(error.type,equals,SIGABRT)",
                "count_if(error.type,notEquals,SIGABRT)",
            ],
        )
        self.assertCountEqual(query.where, self.default_conditions)
        self.assertCountEqual(
            query.aggregates,
            [
                Function(
                    "countIf",
                    [
                        Function(
                            "has",
                            [
                                Column("exception_stacks.type"),
                                "SIGABRT",
                            ],
                        ),
                    ],
                    "count_if_error_type_equals_SIGABRT",
                ),
                Function(
                    "countIf",
                    [
                        Function(
                            "equals",
                            [
                                Function(
                                    "has",
                                    [
                                        Column("exception_stacks.type"),
                                        "SIGABRT",
                                    ],
                                ),
                                0,
                            ],
                        ),
                    ],
                    "count_if_error_type_notEquals_SIGABRT",
                ),
            ],
        )

    def test_count_if_with_tags(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "count_if(foo,equals,bar)",
                'count_if(foo,notEquals,"baz")',
            ],
        )
        self.assertCountEqual(query.where, self.default_conditions)
        self.assertCountEqual(
            query.aggregates,
            [
                Function(
                    "countIf",
                    [
                        Function("equals", [Column("tags[foo]"), "bar"]),
                    ],
                    "count_if_foo_equals_bar",
                ),
                Function(
                    "countIf",
                    [
                        Function("notEquals", [Column("tags[foo]"), "baz"]),
                    ],
                    "count_if_foo_notEquals__baz",
                ),
            ],
        )

    def test_array_join(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=["array_join(measurements_key)", "count()"],
            config=QueryBuilderConfig(
                functions_acl=["array_join"],
            ),
        )
        array_join_column = Function(
            "arrayJoin",
            [Column("measurements.key")],
            "array_join_measurements_key",
        )
        self.assertCountEqual(query.columns, [array_join_column, Function("count", [], "count")])
        # make sure the the array join columns are present in gropuby
        self.assertCountEqual(query.groupby, [array_join_column])

    def test_retention(self):
        old_start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        old_end = datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)
        old_params = {**self.params, "start": old_start, "end": old_end}
        with self.options({"system.event-retention-days": 10}):
            with pytest.raises(QueryOutsideRetentionError):
                QueryBuilder(
                    Dataset.Discover,
                    old_params,
                    query="",
                    selected_columns=[],
                )

    def test_array_combinator(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=["sumArray(measurements_value)"],
            config=QueryBuilderConfig(
                functions_acl=["sumArray"],
            ),
        )
        self.assertCountEqual(
            query.columns,
            [
                Function(
                    "sum",
                    [Function("arrayJoin", [Column("measurements.value")])],
                    "sumArray_measurements_value",
                )
            ],
        )

    def test_array_combinator_is_private(self):
        with pytest.raises(InvalidSearchQuery, match="sum: no access to private function"):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query="",
                selected_columns=["sumArray(measurements_value)"],
            )

    def test_array_combinator_with_non_array_arg(self):
        with pytest.raises(InvalidSearchQuery, match="stuff is not a valid array column"):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query="",
                selected_columns=["sumArray(stuff)"],
                config=QueryBuilderConfig(
                    functions_acl=["sumArray"],
                ),
            )

    def test_spans_columns(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "array_join(spans_op)",
                "array_join(spans_group)",
                "sumArray(spans_exclusive_time)",
            ],
            config=QueryBuilderConfig(
                functions_acl=["array_join", "sumArray"],
            ),
        )
        self.assertCountEqual(
            query.columns,
            [
                Function("arrayJoin", [Column("spans.op")], "array_join_spans_op"),
                Function("arrayJoin", [Column("spans.group")], "array_join_spans_group"),
                Function(
                    "sum",
                    [Function("arrayJoin", [Column("spans.exclusive_time")])],
                    "sumArray_spans_exclusive_time",
                ),
            ],
        )

    def test_array_join_clause(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "spans_op",
                "count()",
            ],
            array_join="spans_op",
        )
        self.assertCountEqual(
            query.columns,
            [
                AliasedExpression(Column("spans.op"), "spans_op"),
                Function("count", [], "count"),
            ],
        )

        assert query.array_join == [Column("spans.op")]
        query.get_snql_query().validate()

    def test_sample_rate(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "count()",
            ],
            sample_rate=0.1,
        )
        assert query.sample_rate == 0.1
        snql_query = query.get_snql_query().query
        snql_query.validate()
        assert snql_query.match.sample == 0.1

    def test_turbo(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "count()",
            ],
            turbo=True,
        )
        assert query.turbo
        snql_query = query.get_snql_query()
        snql_query.validate()
        assert snql_query.flags.turbo

    def test_auto_aggregation(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="count_unique(user):>10",
            selected_columns=[
                "count()",
            ],
            config=QueryBuilderConfig(
                auto_aggregations=True,
                use_aggregate_conditions=True,
            ),
        )
        snql_query = query.get_snql_query().query
        snql_query.validate()
        self.assertCountEqual(
            snql_query.having,
            [
                Condition(Function("uniq", [Column("user")], "count_unique_user"), Op.GT, 10),
            ],
        )
        self.assertCountEqual(
            snql_query.select,
            [
                Function("uniq", [Column("user")], "count_unique_user"),
                Function("count", [], "count"),
            ],
        )

    def test_auto_aggregation_with_boolean(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            # Nonsense query but doesn't matter
            query="count_unique(user):>10 OR count_unique(user):<10",
            selected_columns=[
                "count()",
            ],
            config=QueryBuilderConfig(
                auto_aggregations=True,
                use_aggregate_conditions=True,
            ),
        )
        snql_query = query.get_snql_query().query
        snql_query.validate()
        self.assertCountEqual(
            snql_query.having,
            [
                Or(
                    [
                        Condition(
                            Function("uniq", [Column("user")], "count_unique_user"), Op.GT, 10
                        ),
                        Condition(
                            Function("uniq", [Column("user")], "count_unique_user"), Op.LT, 10
                        ),
                    ]
                )
            ],
        )
        self.assertCountEqual(
            snql_query.select,
            [
                Function("uniq", [Column("user")], "count_unique_user"),
                Function("count", [], "count"),
            ],
        )

    def test_disable_auto_aggregation(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="count_unique(user):>10",
            selected_columns=[
                "count()",
            ],
            config=QueryBuilderConfig(
                auto_aggregations=False,
                use_aggregate_conditions=True,
            ),
        )
        # With count_unique only in a condition and no auto_aggregations this should raise a invalid search query
        with pytest.raises(InvalidSearchQuery):
            query.get_snql_query()

    def test_query_chained_or_tip(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="field:a OR field:b OR field:c",
            selected_columns=[
                "field",
            ],
        )
        assert constants.QUERY_TIPS["CHAINED_OR"] in query.tips["query"]

    def test_chained_or_with_different_terms(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="field:a or field:b or event.type:transaction or transaction:foo",
            selected_columns=[
                "field",
            ],
        )
        # This query becomes something roughly like:
        # field:a or (field:b or (event.type:transaciton or transaction: foo))
        assert constants.QUERY_TIPS["CHAINED_OR"] in query.tips["query"]

        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="event.type:transaction or transaction:foo or field:a or field:b",
            selected_columns=[
                "field",
            ],
        )
        assert constants.QUERY_TIPS["CHAINED_OR"] in query.tips["query"]

    def test_chained_or_with_different_terms_with_and(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            # There's an implicit and between field:b, and event.type:transaction
            query="field:a or field:b event.type:transaction",
            selected_columns=[
                "field",
            ],
        )
        # This query becomes something roughly like:
        # field:a or (field:b and event.type:transaction)
        assert constants.QUERY_TIPS["CHAINED_OR"] not in query.tips["query"]

        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            # There's an implicit and between event.type:transaction, and field:a
            query="event.type:transaction field:a or field:b",
            selected_columns=[
                "field",
            ],
        )
        # This query becomes something roughly like:
        # field:a or (field:b and event.type:transaction)
        assert constants.QUERY_TIPS["CHAINED_OR"] not in query.tips["query"]

    def test_group_by_not_in_select(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "count()",
                "event.type",
            ],
            groupby_columns=[
                "transaction",
            ],
        )
        snql_query = query.get_snql_query().query
        self.assertCountEqual(
            snql_query.select,
            [
                Function("count", [], "count"),
                AliasedExpression(Column("type"), "event.type"),
            ],
        )
        self.assertCountEqual(
            snql_query.groupby,
            [
                AliasedExpression(Column("type"), "event.type"),
                Column("transaction"),
            ],
        )

    def test_group_by_duplicates_select(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            query="",
            selected_columns=[
                "count()",
                "transaction",
            ],
            groupby_columns=[
                "transaction",
            ],
        )
        snql_query = query.get_snql_query().query
        self.assertCountEqual(
            snql_query.select,
            [
                Function("count", [], "count"),
                Column("transaction"),
            ],
        )
        self.assertCountEqual(
            snql_query.groupby,
            [
                Column("transaction"),
            ],
        )

    def test_missing_function(self):
        with pytest.raises(InvalidSearchQuery):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query="",
                selected_columns=[
                    "count_all_the_things_that_i_want()",
                    "transaction",
                ],
                groupby_columns=[
                    "transaction",
                ],
            )

    def test_id_filter_non_uuid(self):
        with pytest.raises(
            InvalidSearchQuery, match=re.escape(INVALID_ID_DETAILS.format("Filter ID"))
        ):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query="id:foo",
                selected_columns=["count()"],
            )

    def test_trace_id_filter_non_uuid(self):
        with pytest.raises(
            InvalidSearchQuery, match=re.escape(INVALID_ID_DETAILS.format("Filter Trace ID"))
        ):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query="trace:foo",
                selected_columns=["count()"],
            )

    def test_profile_id_filter_non_uuid(self):
        with pytest.raises(
            InvalidSearchQuery, match=re.escape(INVALID_ID_DETAILS.format("Filter Profile ID"))
        ):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query="profile.id:foo",
                selected_columns=["count()"],
            )

    def test_orderby_raw_empty_equation(self):
        with pytest.raises(InvalidSearchQuery, match=re.escape("Cannot sort by an empty equation")):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                query="",
                selected_columns=["count()"],
                orderby="equation|",
            )
