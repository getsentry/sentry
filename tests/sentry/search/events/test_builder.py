import datetime
import math
import re
from typing import List
from unittest import mock

import pytest
from django.utils import timezone
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op, Or
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy

from sentry import options
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder import (
    HistogramMetricQueryBuilder,
    MetricsQueryBuilder,
    QueryBuilder,
    TimeseriesMetricQueryBuilder,
)
from sentry.search.events.types import HistogramParams
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.utils import resolve_tag_key, resolve_tag_value
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase, TestCase
from sentry.utils.snuba import Dataset, QueryOutsideRetentionError

pytestmark = pytest.mark.sentry_metrics


class QueryBuilderTest(TestCase):
    def setUp(self):
        self.start = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=15, second=0, microsecond=0
        ) - datetime.timedelta(days=2)
        self.end = self.start + datetime.timedelta(days=1)
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
            "environment:prod",
            ["environment"],
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
            "environment:[dev, prod]",
            ["environment"],
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
        self.params["environment"] = ["", "prod"]
        query = QueryBuilder(Dataset.Discover, self.params, selected_columns=["environment"])

        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                Or(
                    [
                        Condition(Column("environment"), Op.IS_NULL),
                        Condition(Column("environment"), Op.EQ, "prod"),
                    ]
                ),
            ],
        )
        query.get_snql_query().validate()

        self.params["environment"] = ["dev", "prod"]
        query = QueryBuilder(Dataset.Discover, self.params, selected_columns=["environment"])

        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                Condition(Column("environment"), Op.IN, ["dev", "prod"]),
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
            f"project:{project1.slug}",
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
                f"project:{project1.slug}",
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
            Dataset.Discover, self.params, f"project:{project1.slug}", selected_columns=["project"]
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
            "",
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

    def test_count_if_with_tags(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "",
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
            "",
            selected_columns=["array_join(measurements_key)", "count()"],
            functions_acl=["array_join"],
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
                    "",
                    selected_columns=[],
                )

    def test_array_combinator(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "",
            selected_columns=["sumArray(measurements_value)"],
            functions_acl=["sumArray"],
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
                "",
                selected_columns=["sumArray(measurements_value)"],
            )

    def test_array_combinator_with_non_array_arg(self):
        with pytest.raises(InvalidSearchQuery, match="stuff is not a valid array column"):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                "",
                selected_columns=["sumArray(stuff)"],
                functions_acl=["sumArray"],
            )

    def test_spans_columns(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "",
            selected_columns=[
                "array_join(spans_op)",
                "array_join(spans_group)",
                "sumArray(spans_exclusive_time)",
            ],
            functions_acl=["array_join", "sumArray"],
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
            "",
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
            "",
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
            "",
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
            "count_unique(user):>10",
            selected_columns=[
                "count()",
            ],
            auto_aggregations=True,
            use_aggregate_conditions=True,
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
            "count_unique(user):>10 OR count_unique(user):<10",
            selected_columns=[
                "count()",
            ],
            auto_aggregations=True,
            use_aggregate_conditions=True,
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
            "count_unique(user):>10",
            selected_columns=[
                "count()",
            ],
            auto_aggregations=False,
            use_aggregate_conditions=True,
        )
        # With count_unique only in a condition and no auto_aggregations this should raise a invalid search query
        with pytest.raises(InvalidSearchQuery):
            query.get_snql_query()

    def test_query_chained_or_tip(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "field:a OR field:b OR field:c",
            selected_columns=[
                "field",
            ],
        )
        assert constants.QUERY_TIPS["CHAINED_OR"] in query.tips["query"]

    def test_chained_or_with_different_terms(self):
        query = QueryBuilder(
            Dataset.Discover,
            self.params,
            "field:a or field:b or event.type:transaction or transaction:foo",
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
            "event.type:transaction or transaction:foo or field:a or field:b",
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
            "field:a or field:b event.type:transaction",
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
            "event.type:transaction field:a or field:b",
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
            "",
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
            "",
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
                "",
                selected_columns=[
                    "count_all_the_things_that_i_want()",
                    "transaction",
                ],
                groupby_columns=[
                    "transaction",
                ],
            )


def _metric_percentile_definition(
    org_id, quantile, field="transaction.duration", alias=None
) -> Function:
    if alias is None:
        alias = f"p{quantile}_{field.replace('.', '_')}"
    return Function(
        "arrayElement",
        [
            Function(
                f"quantilesIf(0.{quantile.rstrip('0')})",
                [
                    Column("value"),
                    Function(
                        "equals",
                        [
                            Column("metric_id"),
                            indexer.resolve(
                                UseCaseKey.PERFORMANCE, org_id, constants.METRICS_MAP[field]
                            ),
                        ],
                    ),
                ],
            ),
            1,
        ],
        alias,
    )


def _metric_conditions(org_id, metrics) -> List[Condition]:
    return [
        Condition(
            Column("metric_id"),
            Op.IN,
            sorted(
                indexer.resolve(UseCaseKey.PERFORMANCE, org_id, constants.METRICS_MAP[metric])
                for metric in metrics
            ),
        )
    ]


class MetricBuilderBaseTest(MetricsEnhancedPerformanceTestCase):
    METRIC_STRINGS = [
        "foo_transaction",
        "bar_transaction",
        "baz_transaction",
    ]
    DEFAULT_METRIC_TIMESTAMP = datetime.datetime(
        2015, 1, 1, 10, 15, 0, tzinfo=timezone.utc
    ) + datetime.timedelta(minutes=1)

    def setUp(self):
        super().setUp()
        self.start = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        ) - datetime.timedelta(days=18)
        self.end = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.projects = [self.project.id]
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }
        # These conditions should always be on a query when self.params is passed
        self.default_conditions = [
            Condition(Column("timestamp"), Op.GTE, self.start),
            Condition(Column("timestamp"), Op.LT, self.end),
            Condition(Column("project_id"), Op.IN, self.projects),
            Condition(Column("org_id"), Op.EQ, self.organization.id),
        ]

        if not options.get("sentry-metrics.performance.tags-values-are-strings"):
            for string in self.METRIC_STRINGS:
                indexer.record(
                    use_case_id=UseCaseKey.PERFORMANCE, org_id=self.organization.id, string=string
                )
            self.expected_tag_value_type = "UInt64"
        else:
            self.expected_tag_value_type = "String"

        indexer.record(
            use_case_id=UseCaseKey.PERFORMANCE, org_id=self.organization.id, string="transaction"
        )

    def setup_orderby_data(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            50,
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            2,
            metric="user",
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )

    def build_transaction_transform(self, alias):
        if not options.get("sentry-metrics.performance.tags-values-are-strings"):
            tags_col = "tags"
            unparam = indexer.resolve(
                UseCaseKey.PERFORMANCE, self.organization.id, "<< unparameterized >>"
            )
            null = 0
        else:
            tags_col = "tags_raw"
            unparam = "<< unparameterized >>"
            null = ""

        return Function(
            "transform",
            [
                Column(
                    f"{tags_col}[{indexer.resolve(UseCaseKey.PERFORMANCE, self.organization.id, 'transaction')}]"
                ),
                [null],
                [unparam],
            ],
            alias,
        )


class MetricQueryBuilderTest(MetricBuilderBaseTest):
    def test_default_conditions(self):
        query = MetricsQueryBuilder(
            self.params, "", dataset=Dataset.PerformanceMetrics, selected_columns=[]
        )
        self.assertCountEqual(query.where, self.default_conditions)

    def test_column_resolution(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["tags[transaction]", "transaction"],
        )
        self.assertCountEqual(
            query.columns,
            [
                self.build_transaction_transform("tags[transaction]"),
                self.build_transaction_transform("transaction"),
            ],
        )

    def test_simple_aggregates(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p50(transaction.duration)",
                "p75(measurements.lcp)",
                "p90(measurements.fcp)",
                "p95(measurements.cls)",
                "p99(measurements.fid)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(
                    self.organization.id,
                    [
                        "transaction.duration",
                        "measurements.lcp",
                        "measurements.fcp",
                        "measurements.cls",
                        "measurements.fid",
                    ],
                ),
            ],
        )
        self.assertCountEqual(
            query.distributions,
            [
                _metric_percentile_definition(self.organization.id, "50"),
                _metric_percentile_definition(self.organization.id, "75", "measurements.lcp"),
                _metric_percentile_definition(self.organization.id, "90", "measurements.fcp"),
                _metric_percentile_definition(self.organization.id, "95", "measurements.cls"),
                _metric_percentile_definition(self.organization.id, "99", "measurements.fid"),
            ],
        )

    def test_custom_percentile_throws_error(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                "",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "percentile(transaction.duration, 0.11)",
                ],
            )

    def test_percentile_function(self):
        self.maxDiff = None
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "percentile(transaction.duration, 0.75)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(
                    self.organization.id,
                    [
                        "transaction.duration",
                    ],
                ),
            ],
        )
        self.assertCountEqual(
            query.distributions,
            [
                Function(
                    "arrayElement",
                    [
                        Function(
                            "quantilesIf(0.75)",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        indexer.resolve(
                                            UseCaseKey.PERFORMANCE,
                                            self.organization.id,
                                            constants.METRICS_MAP["transaction.duration"],
                                        ),
                                    ],
                                ),
                            ],
                        ),
                        1,
                    ],
                    "percentile_transaction_duration_0_75",
                )
            ],
        )

    def test_metric_condition_dedupe(self):
        org_id = 1
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p50(transaction.duration)",
                "p75(transaction.duration)",
                "p90(transaction.duration)",
                "p95(transaction.duration)",
                "p99(transaction.duration)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(org_id, ["transaction.duration"]),
            ],
        )

    def test_p100(self):
        """While p100 isn't an actual quantile in the distributions table, its equivalent to max"""
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p100(transaction.duration)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(
                    self.organization.id,
                    [
                        "transaction.duration",
                    ],
                ),
            ],
        )
        self.assertCountEqual(
            query.distributions,
            [
                Function(
                    "maxIf",
                    [
                        Column("value"),
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                indexer.resolve(
                                    UseCaseKey.PERFORMANCE,
                                    self.organization.id,
                                    constants.METRICS_MAP["transaction.duration"],
                                ),
                            ],
                        ),
                    ],
                    "p100_transaction_duration",
                )
            ],
        )

    def test_grouping(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
            ],
        )
        transaction = self.build_transaction_transform("transaction")
        project = AliasedExpression(
            Column("project_id"),
            "project",
        )
        self.assertCountEqual(
            query.groupby,
            [
                transaction,
                project,
            ],
        )
        self.assertCountEqual(
            query.distributions, [_metric_percentile_definition(self.organization.id, "95")]
        )

    def test_transaction_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            "transaction:foo_transaction",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        transaction_name = resolve_tag_value(
            UseCaseKey.PERFORMANCE, self.organization.id, "foo_transaction"
        )
        transaction = Column(
            resolve_tag_key(UseCaseKey.PERFORMANCE, self.organization.id, "transaction")
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(transaction, Op.EQ, transaction_name),
            ],
        )

    def test_transaction_in_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            "transaction:[foo_transaction, bar_transaction]",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        transaction_name1 = resolve_tag_value(
            UseCaseKey.PERFORMANCE, self.organization.id, "foo_transaction"
        )
        transaction_name2 = resolve_tag_value(
            UseCaseKey.PERFORMANCE, self.organization.id, "bar_transaction"
        )
        transaction = Column(
            resolve_tag_key(UseCaseKey.PERFORMANCE, self.organization.id, "transaction")
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(transaction, Op.IN, [transaction_name1, transaction_name2]),
            ],
        )

    def test_missing_transaction_index(self):
        if options.get("sentry-metrics.performance.tags-values-are-strings"):
            pytest.skip("test does not apply if tag values are in clickhouse")

        with pytest.raises(
            IncompatibleMetricsQuery,
            match=re.compile("Transaction value .* in filter not found"),
        ):
            MetricsQueryBuilder(
                self.params,
                "transaction:something_else",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=["transaction", "project", "p95(transaction.duration)"],
            )

    def test_missing_transaction_index_in_filter(self):
        if options.get("sentry-metrics.performance.tags-values-are-strings"):
            pytest.skip("test does not apply if tag values are in clickhouse")
        with pytest.raises(
            IncompatibleMetricsQuery,
            match=re.compile("Transaction value .* in filter not found"),
        ):
            MetricsQueryBuilder(
                self.params,
                "transaction:[something_else, something_else2]",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=["transaction", "project", "p95(transaction.duration)"],
            )

    def test_incorrect_parameter_for_metrics(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                f"project:{self.project.slug}",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=["transaction", "count_unique(test)"],
            )

    def test_project_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(Column("project_id"), Op.EQ, self.project.id),
            ],
        )

    def test_limit_validation(self):
        # 51 is ok
        MetricsQueryBuilder(self.params, limit=51)
        # None is ok, defaults to 50
        query = MetricsQueryBuilder(self.params)
        assert query.limit.limit == 50
        # anything higher should throw an error
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(self.params, limit=10_000)

    def test_granularity(self):
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": self.projects,
                "start": start,
                "end": end,
            }
            query = MetricsQueryBuilder(params)
            return query.granularity.granularity

        # If we're doing atleast day and its midnight we should use the daily bucket
        start = datetime.datetime(2015, 5, 18, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 0, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "A day at midnight"

        # If we're doing several days, allow more range
        start = datetime.datetime(2015, 5, 18, 0, 10, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 23, 59, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "Several days"

        # We're doing a long period, use the biggest granularity
        start = datetime.datetime(2015, 5, 18, 12, 33, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 7, 28, 17, 22, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "Big range"

        # If we're on the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 20, 1, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour"

        # If we're close to the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 21, 1, 57, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour, close"

        # A decently long period but not close to hour ends, still use hour bucket
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 1, 57, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour, long period"

        # Even though this is >24h of data, because its a random hour in the middle of the day to the next we use minute
        # granularity
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 15, 1, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "A few hours, but random minute"

        # Less than a minute, no reason to work hard for such a small window, just use a minute
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 10, 15, 34, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "less than a minute"

    def test_granularity_boundaries(self):
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": self.projects,
                "start": start,
                "end": end,
            }
            query = MetricsQueryBuilder(params)
            return query.granularity.granularity

        # See resolve_granularity on the MQB to see what these boundaries are

        # Exactly 30d, at the 30 minute boundary
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "30d at boundary"

        # Near 30d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 30, 23, 29, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 30d, but 1 hour before boundary for end"

        # Near 30d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 30d, but 1 hour after boundary for start"

        # Exactly 3d
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "3d at boundary"

        # Near 3d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 13, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 3, 23, 45, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 3d, but 1 hour before boundary for end"

        # Near 3d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 46, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 46, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 3d, but 1 hour after boundary for start"

        # exactly 12 hours
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "12h at boundary"

        # Near 12h, but 15 minutes before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 0, 0, tzinfo=timezone.utc)
        assert (
            get_granularity(start, end) == 60
        ), "12h at boundary, but 15 min before the boundary for end"

        # Near 12h, but 15 minutes after the boundary for start
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        assert (
            get_granularity(start, end) == 60
        ), "12h at boundary, but 15 min after the boundary for start"

    def test_get_snql_query(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["p90(transaction.duration)"],
        )
        snql_request = query.get_snql_query()
        assert snql_request.dataset == "generic_metrics"
        snql_query = snql_request.query
        self.assertCountEqual(
            snql_query.select,
            [
                _metric_percentile_definition(self.organization.id, "90"),
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
            ],
        )

    def test_get_snql_query_errors_with_multiple_dataset(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["p90(transaction.duration)", "count_unique(user)"],
        )
        with pytest.raises(NotImplementedError):
            query.get_snql_query()

    def test_get_snql_query_errors_with_no_functions(self):
        query = MetricsQueryBuilder(
            self.params, "", dataset=Dataset.PerformanceMetrics, selected_columns=["project"]
        )
        with pytest.raises(IncompatibleMetricsQuery):
            query.get_snql_query()

    def test_run_query(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            100,
            metric="measurements.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1000,
            metric="measurements.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95(transaction.duration)",
                "p100(measurements.lcp)",
            ],
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "p95_transaction_duration": 100,
            "p100_measurements_lcp": 1000,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "p100_measurements_lcp", "type": "Float64"},
            ],
        )

    def test_run_query_multiple_tables(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_multiple_groupby_orderby_distribution(self):
        self.setup_orderby_data()
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="-p95(transaction.duration)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_multiple_groupby_orderby_set(self):
        self.setup_orderby_data()
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="-count_unique(user)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_project_orderby(self):
        project_1 = self.create_project(slug="aaaaaa")
        project_2 = self.create_project(slug="zzzzzz")
        for project in [project_1, project_2]:
            self.store_transaction_metric(
                100,
                tags={"transaction": "foo_transaction"},
                project=project.id,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        self.params["project_id"] = [project_1.id, project_2.id]

        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
            ],
            orderby="project",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_1.id,
            "p95_transaction_duration": 100,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_2.id,
            "p95_transaction_duration": 100,
        }

        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
            ],
            orderby="-project",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_2.id,
            "p95_transaction_duration": 100,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_1.id,
            "p95_transaction_duration": 100,
        }

    def test_run_query_with_tag_orderby(self):
        with pytest.raises(IncompatibleMetricsQuery):
            query = MetricsQueryBuilder(
                self.params,
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "transaction",
                    "project",
                    "p95(transaction.duration)",
                ],
                orderby="transaction",
            )
            query.run_query("test_query")

    # TODO: multiple groupby with counter

    def test_run_query_with_events_per_aggregates(self):
        for i in range(5):
            self.store_transaction_metric(
                100, timestamp=self.start + datetime.timedelta(minutes=i * 15)
            )
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "eps()",
                "epm()",
                "tps()",
                "tpm()",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        # Check the aliases are correct
        assert data["epm"] == data["tpm"]
        assert data["eps"] == data["tps"]
        # Check the values are correct
        assert data["tpm"] == 5 / ((self.end - self.start).total_seconds() / 60)
        assert data["tpm"] / 60 == data["tps"]

    def test_count(self):
        for _ in range(3):
            self.store_transaction_metric(
                150,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                50,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "count()",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["count"] == 6

    def test_avg_duration(self):
        for _ in range(3):
            self.store_transaction_metric(
                150,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                50,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "avg(transaction.duration)",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["avg_transaction_duration"] == 100

    def test_avg_span_http(self):
        for _ in range(3):
            self.store_transaction_metric(
                150,
                metric="spans.http",
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                50,
                metric="spans.http",
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "avg(spans.http)",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["avg_spans_http"] == 100

    def test_failure_rate(self):
        for _ in range(3):
            self.store_transaction_metric(
                100,
                tags={"transaction.status": "internal_error"},
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                100,
                tags={"transaction.status": "ok"},
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "failure_rate()",
                "failure_count()",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["failure_rate"] == 0.5
        assert data["failure_count"] == 3

    def test_run_function_without_having_or_groupby(self):
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "count_unique(user)",
            ],
        )
        primary, result = query._create_query_framework()
        assert primary == "set"

    def test_run_query_with_multiple_groupby_orderby_null_values_in_second_entity(self):
        """Since the null value is on count_unique(user) we will still get baz_transaction since we query distributions
        first which will have it, and then just not find a unique count in the second"""
        self.setup_orderby_data()
        self.store_transaction_metric(
            200,
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="p95(transaction.duration)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 3
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        assert result["data"][2] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
            "count_unique_user": 0,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    @pytest.mark.skip(
        reason="Currently cannot handle the case where null values are in the first entity"
    )
    def test_run_query_with_multiple_groupby_orderby_null_values_in_first_entity(self):
        """But if the null value is in the first entity, it won't show up in the groupby values, which means the
        transaction will be missing"""
        self.setup_orderby_data()
        self.store_transaction_metric(200, tags={"transaction": "baz_transaction"})
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="count_unique(user)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 3
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        assert result["data"][2] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }

    def test_multiple_entity_orderby_fails(self):
        with pytest.raises(IncompatibleMetricsQuery):
            query = MetricsQueryBuilder(
                self.params,
                f"project:{self.project.slug}",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "transaction",
                    "project",
                    "p95(transaction.duration)",
                    "count_unique(user)",
                ],
                orderby=["-count_unique(user)", "p95(transaction.duration)"],
            )
            query.run_query("test_query")

    def test_multiple_entity_query_fails(self):
        with pytest.raises(IncompatibleMetricsQuery):
            query = MetricsQueryBuilder(
                self.params,
                "p95(transaction.duration):>5s AND count_unique(user):>0",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "transaction",
                    "project",
                    "p95(transaction.duration)",
                    "count_unique(user)",
                ],
                use_aggregate_conditions=True,
            )
            query.run_query("test_query")

    def test_query_entity_does_not_match_orderby(self):
        with pytest.raises(IncompatibleMetricsQuery):
            query = MetricsQueryBuilder(
                self.params,
                "count_unique(user):>0",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "transaction",
                    "project",
                    "p95(transaction.duration)",
                    "count_unique(user)",
                ],
                orderby=["p95(transaction.duration)"],
                use_aggregate_conditions=True,
            )
            query.run_query("test_query")

    def test_aggregate_query_with_multiple_entities_without_orderby(self):
        self.store_transaction_metric(
            200,
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            2,
            metric="user",
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        # This will query both sets & distribution cause of selected columns
        query = MetricsQueryBuilder(
            self.params,
            # Filter by count_unique since the default primary is distributions without an orderby
            "count_unique(user):>1",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            allow_metric_aggregates=True,
            use_aggregate_conditions=True,
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
            "count_unique_user": 2,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_aggregate_query_with_multiple_entities_with_orderby(self):
        self.store_transaction_metric(
            200,
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        # This will query both sets & distribution cause of selected columns
        query = MetricsQueryBuilder(
            self.params,
            "p95(transaction.duration):>100",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby=["p95(transaction.duration)"],
            allow_metric_aggregates=True,
            use_aggregate_conditions=True,
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseKey.PERFORMANCE,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
            "count_unique_user": 1,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_invalid_column_arg(self):
        for function in [
            "count_unique(transaction.duration)",
            "count_miserable(measurements.fcp)",
            "p75(user)",
            "count_web_vitals(user, poor)",
        ]:
            with pytest.raises(IncompatibleMetricsQuery):
                MetricsQueryBuilder(
                    self.params,
                    "",
                    dataset=Dataset.PerformanceMetrics,
                    selected_columns=[function],
                )

    def test_orderby_field_alias(self):
        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95()",
            ],
            orderby=["p95"],
        )
        assert len(query.orderby) == 1
        assert query.orderby[0].exp == _metric_percentile_definition(
            self.organization.id, "95", "transaction.duration", "p95"
        )

        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95() as test",
            ],
            orderby=["test"],
        )
        assert len(query.orderby) == 1
        assert query.orderby[0].exp == _metric_percentile_definition(
            self.organization.id, "95", "transaction.duration", "test"
        )

    def test_error_if_aggregates_disallowed(self):
        def run_query(query, use_aggregate_conditions):
            with pytest.raises(IncompatibleMetricsQuery):
                MetricsQueryBuilder(
                    self.params,
                    dataset=Dataset.PerformanceMetrics,
                    selected_columns=[
                        "transaction",
                        "p95()",
                        "count_unique(user)",
                    ],
                    query=query,
                    allow_metric_aggregates=False,
                    use_aggregate_conditions=use_aggregate_conditions,
                )

        queries = [
            "p95():>5s",
            "count_unique(user):>0",
            "transaction:foo_transaction AND (!transaction:bar_transaction OR p95():>5s)",
        ]
        for query in queries:
            for use_aggregate_conditions in [True, False]:
                run_query(query, use_aggregate_conditions)

    def test_no_error_if_aggregates_disallowed_but_no_aggregates_included(self):
        MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95()",
                "count_unique(user)",
            ],
            query="transaction:foo_transaction",
            allow_metric_aggregates=False,
            use_aggregate_conditions=True,
        )

        MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95()",
                "count_unique(user)",
            ],
            query="transaction:foo_transaction",
            allow_metric_aggregates=False,
            use_aggregate_conditions=False,
        )

    def test_multiple_dataset_but_no_data(self):
        """When there's no data from the primary dataset we shouldn't error out"""
        result = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p50()",
                "count_unique(user)",
            ],
            allow_metric_aggregates=False,
            use_aggregate_conditions=True,
        ).run_query("test")
        assert len(result["data"]) == 1
        data = result["data"][0]
        assert data["count_unique_user"] == 0
        # Handled by the discover transform later so its fine that this is nan
        assert math.isnan(data["p50"])

    @mock.patch("sentry.search.events.builder.raw_snql_query")
    @mock.patch("sentry.search.events.builder.indexer.resolve", return_value=-1)
    def test_dry_run_does_not_hit_indexer_or_clickhouse(self, mock_indexer, mock_query):
        query = MetricsQueryBuilder(
            self.params,
            # Include a tag:value search as well since that resolves differently
            f"project:{self.project.slug} transaction:foo_transaction",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95(transaction.duration)",
                "p100(measurements.lcp)",
                "apdex()",
                "count_web_vitals(measurements.lcp, good)",
            ],
            dry_run=True,
        )
        query.run_query("test_query")
        assert not mock_indexer.called
        assert not mock_query.called

    @mock.patch("sentry.search.events.builder.indexer.resolve", return_value=-1)
    def test_multiple_references_only_resolve_index_once(self, mock_indexer):
        MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug} transaction:foo_transaction transaction:foo_transaction",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
            ],
        )

        expected = [mock.call(UseCaseKey.PERFORMANCE, self.organization.id, "transaction")]

        if not options.get("sentry-metrics.performance.tags-values-are-strings"):
            expected.append(
                mock.call(UseCaseKey.PERFORMANCE, self.organization.id, "foo_transaction")
            )
            expected.append(
                mock.call(UseCaseKey.PERFORMANCE, self.organization.id, "<< unparameterized >>")
            )

        expected.extend(
            [
                mock.call(
                    UseCaseKey.PERFORMANCE,
                    self.organization.id,
                    constants.METRICS_MAP["measurements.lcp"],
                ),
                mock.call(UseCaseKey.PERFORMANCE, self.organization.id, "measurement_rating"),
            ]
        )

        if not options.get("sentry-metrics.performance.tags-values-are-strings"):
            expected.append(mock.call(UseCaseKey.PERFORMANCE, self.organization.id, "good"))

        self.assertCountEqual(mock_indexer.mock_calls, expected)

    def test_custom_measurement_allowed(self):
        MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "avg(measurements.custom.measurement)",
                "p50(measurements.custom.measurement)",
                "p75(measurements.custom.measurement)",
                "p90(measurements.custom.measurement)",
                "p95(measurements.custom.measurement)",
                "p99(measurements.custom.measurement)",
                "p100(measurements.custom.measurement)",
                "percentile(measurements.custom.measurement, 0.95)",
                "sum(measurements.custom.measurement)",
                "max(measurements.custom.measurement)",
                "min(measurements.custom.measurement)",
                "count_unique(user)",
            ],
            query="transaction:foo_transaction",
            allow_metric_aggregates=False,
            use_aggregate_conditions=True,
            # Use dry run for now to not hit indexer
            dry_run=True,
        )

    def test_group_by_not_in_select(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p90(transaction.duration)",
                "project",
            ],
            groupby_columns=[
                "transaction",
            ],
        )
        snql_query = query.get_snql_query().query
        project = AliasedExpression(
            Column("project_id"),
            "project",
        )
        self.assertCountEqual(
            snql_query.select,
            [
                _metric_percentile_definition(self.organization.id, "90"),
                project,
            ],
        )
        self.assertCountEqual(
            snql_query.groupby,
            [project, self.build_transaction_transform("transaction")],
        )

    def test_missing_function(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
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


class TimeseriesMetricQueryBuilderTest(MetricBuilderBaseTest):
    def test_get_query(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="",
            selected_columns=["p50(transaction.duration)"],
        )
        snql_query = query.get_snql_query()
        assert len(snql_query) == 1
        query = snql_query[0].query
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
            ],
        )
        assert query.select == [_metric_percentile_definition(self.organization.id, "50")]
        assert query.match.name == "generic_metrics_distributions"
        assert query.granularity.granularity == 60

    def test_default_conditions(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="",
            selected_columns=[],
        )
        self.assertCountEqual(query.where, self.default_conditions)

    def test_granularity(self):
        # Need to pick granularity based on the period and interval for timeseries
        def get_granularity(start, end, interval):
            params = {
                "organization_id": self.organization.id,
                "project_id": self.projects,
                "start": start,
                "end": end,
            }
            query = TimeseriesMetricQueryBuilder(params, interval=interval)
            return query.granularity.granularity

        # If we're doing atleast day and its midnight we should use the daily bucket
        start = datetime.datetime(2015, 5, 18, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 0, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "A day at midnight, 15min interval"
        assert get_granularity(start, end, 3600) == 60, "A day at midnight, 1hr interval"
        assert get_granularity(start, end, 86400) == 86400, "A day at midnight, 1d interval"

        # If we're on the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 20, 1, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "On the hour, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "On the hour, 1hr interval"
        assert get_granularity(start, end, 86400) == 3600, "On the hour, 1d interval"

        # Even though this is >24h of data, because its a random hour in the middle of the day to the next we use minute
        # granularity
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 15, 15, 1, tzinfo=timezone.utc)
        assert (
            get_granularity(start, end, 900) == 60
        ), "A few hours, but random minute, 15min interval"
        assert (
            get_granularity(start, end, 3600) == 3600
        ), "A few hours, but random minute, 1hr interval"
        assert (
            get_granularity(start, end, 86400) == 3600
        ), "A few hours, but random minute, 1d interval"

        # Less than a minute, no reason to work hard for such a small window, just use a minute
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 10, 15, 34, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "less than a minute, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "less than a minute, 1hr interval"
        assert get_granularity(start, end, 86400) == 3600, "less than a minute, 1d interval"

    def test_transaction_in_filter(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            interval=900,
            dataset=Dataset.PerformanceMetrics,
            query="transaction:[foo_transaction, bar_transaction]",
            selected_columns=["p95(transaction.duration)"],
        )
        transaction_name1 = resolve_tag_value(
            UseCaseKey.PERFORMANCE, self.organization.id, "foo_transaction"
        )
        transaction_name2 = resolve_tag_value(
            UseCaseKey.PERFORMANCE, self.organization.id, "bar_transaction"
        )

        transaction = Column(
            resolve_tag_key(UseCaseKey.PERFORMANCE, self.organization.id, "transaction")
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(transaction, Op.IN, [transaction_name1, transaction_name2]),
            ],
        )

    def test_missing_transaction_index(self):
        if options.get("sentry-metrics.performance.tags-values-are-strings"):
            pytest.skip("test does not apply if tag values are in clickhouse")
        with pytest.raises(
            IncompatibleMetricsQuery,
            match=re.compile("Transaction value .* in filter not found"),
        ):
            TimeseriesMetricQueryBuilder(
                self.params,
                dataset=Dataset.PerformanceMetrics,
                interval=900,
                query="transaction:something_else",
                selected_columns=["project", "p95(transaction.duration)"],
            )

    def test_missing_transaction_index_in_filter(self):
        if options.get("sentry-metrics.performance.tags-values-are-strings"):
            pytest.skip("test does not apply if tag values are in clickhouse")
        with pytest.raises(
            IncompatibleMetricsQuery,
            match=re.compile("Transaction value .* in filter not found"),
        ):
            TimeseriesMetricQueryBuilder(
                self.params,
                dataset=Dataset.PerformanceMetrics,
                interval=900,
                query="transaction:[something_else, something_else2]",
                selected_columns=["p95(transaction.duration)"],
            )

    def test_project_filter(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query=f"project:{self.project.slug}",
            selected_columns=["p95(transaction.duration)"],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(Column("project_id"), Op.EQ, self.project.id),
            ],
        )

    def test_meta(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            selected_columns=["p50(transaction.duration)", "count_unique(user)"],
        )
        result = query.run_query("test_query")
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "p50_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_with_aggregate_filter(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="p50(transaction.duration):>100",
            selected_columns=["p50(transaction.duration)", "count_unique(user)"],
            allow_metric_aggregates=True,
        )
        # Aggregate conditions should be dropped
        assert query.having == []

    def test_run_query(self):
        for i in range(5):
            self.store_transaction_metric(
                100, timestamp=self.start + datetime.timedelta(minutes=i * 15)
            )
            self.store_transaction_metric(
                1,
                metric="user",
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="",
            selected_columns=["p50(transaction.duration)", "count_unique(user)"],
        )
        result = query.run_query("test_query")
        assert result["data"] == [
            {
                "time": self.start.isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=15)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=30)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=45)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=60)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "p50_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_hour_interval(self):
        # See comment on resolve_time_column for explanation of this test
        self.start = datetime.datetime.now(timezone.utc).replace(
            hour=15, minute=30, second=0, microsecond=0
        )
        self.end = datetime.datetime.fromtimestamp(self.start.timestamp() + 86400, timezone.utc)
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }

        for i in range(5):
            self.store_transaction_metric(
                100,
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query="",
            selected_columns=["epm(3600)"],
        )
        result = query.run_query("test_query")
        date_prefix = self.start.strftime("%Y-%m-%dT")
        assert result["data"] == [
            {"time": f"{date_prefix}15:00:00+00:00", "epm_3600": 2 / (3600 / 60)},
            {"time": f"{date_prefix}16:00:00+00:00", "epm_3600": 3 / (3600 / 60)},
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "epm_3600", "type": "Float64"},
            ],
        )

    def test_run_query_with_granularity_larger_than_interval(self):
        """The base MetricsQueryBuilder with a perfect 1d query will try to use granularity 86400 which is larger than
        the interval of 3600, in this case we want to make sure to use a smaller granularity to get the correct
        result"""
        self.start = datetime.datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        self.end = datetime.datetime.fromtimestamp(self.start.timestamp() + 86400, timezone.utc)
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }

        for i in range(1, 5):
            self.store_transaction_metric(
                100,
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query="",
            selected_columns=["epm(3600)"],
        )
        result = query.run_query("test_query")
        date_prefix = self.start.strftime("%Y-%m-%dT")
        assert result["data"] == [
            {"time": f"{date_prefix}00:00:00+00:00", "epm_3600": 3 / (3600 / 60)},
            {"time": f"{date_prefix}01:00:00+00:00", "epm_3600": 1 / (3600 / 60)},
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "epm_3600", "type": "Float64"},
            ],
        )

    def test_run_query_with_filter(self):
        for i in range(5):
            self.store_transaction_metric(
                100,
                tags={"transaction": "foo_transaction"},
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )
            self.store_transaction_metric(
                200,
                tags={"transaction": "bar_transaction"},
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="transaction:foo_transaction",
            selected_columns=["p50(transaction.duration)"],
        )
        result = query.run_query("test_query")
        assert result["data"] == [
            {"time": self.start.isoformat(), "p50_transaction_duration": 100.0},
            {
                "time": (self.start + datetime.timedelta(minutes=15)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=30)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=45)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=60)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "p50_transaction_duration", "type": "Float64"},
            ],
        )

    def test_error_if_aggregates_disallowed(self):
        def run_query(query):
            with pytest.raises(IncompatibleMetricsQuery):
                TimeseriesMetricQueryBuilder(
                    self.params,
                    interval=900,
                    dataset=Dataset.PerformanceMetrics,
                    query=query,
                    selected_columns=["p50(transaction.duration)"],
                    allow_metric_aggregates=False,
                )

        queries = [
            "p95():>5s",
            "count_unique(user):>0",
            "transaction:foo_transaction AND (!transaction:bar_transaction OR p95():>5s)",
        ]
        for query in queries:
            run_query(query)

    def test_no_error_if_aggregates_disallowed_but_no_aggregates_included(self):
        TimeseriesMetricQueryBuilder(
            self.params,
            interval=900,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["p50(transaction.duration)"],
            query="transaction:foo_transaction",
            allow_metric_aggregates=False,
        )


class HistogramMetricQueryBuilderTest(MetricBuilderBaseTest):
    def test_histogram_columns_set_on_builder(self):
        builder = HistogramMetricQueryBuilder(
            params=self.params,
            dataset=Dataset.PerformanceMetrics,
            query="",
            selected_columns=[
                "histogram(transaction.duration)",
                "histogram(measurements.lcp)",
                "histogram(measurements.fcp) as test",
            ],
            histogram_params=HistogramParams(
                5,
                100,
                0,
                1,  # not used by Metrics
            ),
        )
        self.assertCountEqual(
            builder.histogram_aliases,
            [
                "histogram_transaction_duration",
                "histogram_measurements_lcp",
                "test",
            ],
        )

    def test_get_query(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            450,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )

        query = HistogramMetricQueryBuilder(
            params=self.params,
            dataset=Dataset.PerformanceMetrics,
            query="",
            selected_columns=["histogram(transaction.duration)"],
            histogram_params=HistogramParams(
                5,
                100,
                0,
                1,  # not used by Metrics
            ),
        )
        snql_query = query.run_query("test_query")
        assert len(snql_query["data"]) == 1
        # This data is intepolated via rebucket_histogram
        assert snql_query["data"][0]["histogram_transaction_duration"] == [
            (0.0, 100.0, 0),
            (100.0, 200.0, 2),
            (200.0, 300.0, 1),
            (300.0, 400.0, 1),
            (400.0, 500.0, 1),
        ]

    def test_query_normal_distribution(self):
        for i in range(5):
            for _ in range((5 - abs(i - 2)) ** 2):
                self.store_transaction_metric(
                    100 * i + 50,
                    tags={"transaction": "foo_transaction"},
                    timestamp=self.start + datetime.timedelta(minutes=5),
                )

        query = HistogramMetricQueryBuilder(
            params=self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["histogram(transaction.duration)"],
            histogram_params=HistogramParams(
                5,
                100,
                0,
                1,  # not used by Metrics
            ),
        )
        snql_query = query.run_query("test_query")
        assert len(snql_query["data"]) == 1
        # This data is intepolated via rebucket_histogram
        assert snql_query["data"][0]["histogram_transaction_duration"] == [
            (0.0, 100.0, 10),
            (100.0, 200.0, 17),
            (200.0, 300.0, 23),
            (300.0, 400.0, 17),
            (400.0, 500.0, 10),
        ]
