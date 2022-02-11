import datetime
import re

from django.utils import timezone
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op, Or
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder import MetricsQueryBuilder, QueryBuilder
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.testutils.cases import SessionMetricsTestCase, TestCase
from sentry.utils.snuba import Dataset, QueryOutsideRetentionError


class QueryBuilderTest(TestCase):
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
        with self.assertRaisesRegex(
            InvalidSearchQuery,
            re.escape(
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
                Function(
                    "transform",
                    [
                        Column("project_id"),
                        [project1.id, project2.id],
                        [project1.slug, project2.slug],
                        "",
                    ],
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
                Function(
                    "transform",
                    [
                        Column("project_id"),
                        [project1.id],
                        [project1.slug],
                        "",
                    ],
                    "project",
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
        with self.options({"system.event-retention-days": 10}):
            with self.assertRaises(QueryOutsideRetentionError):
                QueryBuilder(
                    Dataset.Discover,
                    self.params,
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
        with self.assertRaisesRegex(InvalidSearchQuery, "sum: no access to private function"):
            QueryBuilder(
                Dataset.Discover,
                self.params,
                "",
                selected_columns=["sumArray(measurements_value)"],
            )

    def test_array_combinator_with_non_array_arg(self):
        with self.assertRaisesRegex(InvalidSearchQuery, "stuff is not a valid array column"):
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
        snql_query = query.get_snql_query()
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
        assert query.turbo.value
        snql_query = query.get_snql_query()
        snql_query.validate()
        assert snql_query.turbo.value

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
        snql_query = query.get_snql_query()
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
        snql_query = query.get_snql_query()
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
        with self.assertRaises(InvalidSearchQuery):
            query.get_snql_query()


def _metric_percentile_definition(quantile, field="transaction.duration") -> Function:
    return Function(
        "arrayElement",
        [
            Function(
                f"quantilesMergeIf(0.{quantile.rstrip('0')})",
                [
                    Column("percentiles"),
                    Function(
                        "equals",
                        [Column("metric_id"), indexer.resolve(constants.METRICS_MAP[field])],
                    ),
                ],
            ),
            1,
        ],
        f"p{quantile}_{field.replace('.', '_')}",
    )


class MetricQueryBuilderTest(TestCase, SessionMetricsTestCase):
    def setUp(self):
        self.start = datetime.datetime(2021, 1, 1, 10, 15, 1, tzinfo=timezone.utc)
        self.end = datetime.datetime(2021, 1, 19, 10, 15, 1, tzinfo=timezone.utc)
        self.projects = [self.project.id]
        self.organization_id = 1
        self.params = {
            "organization_id": self.organization_id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }
        # These conditions should always be on a query when self.params is passed
        self.default_conditions = [
            Condition(Column("timestamp"), Op.GTE, self.start),
            Condition(Column("timestamp"), Op.LT, self.end),
            Condition(Column("project_id"), Op.IN, self.projects),
            Condition(Column("org_id"), Op.EQ, self.organization_id),
        ]
        PGStringIndexer().bulk_record(
            strings=[
                "transaction",
                "foo_transaction",
                "bar_transaction",
            ]
            + list(constants.METRICS_MAP.values())
        )

    def store_metric(
        self,
        value,
        metric=constants.METRICS_MAP["transaction.duration"],
        entity="metrics_distributions",
        tags=None,
        timestamp=None,
    ):
        if tags is None:
            tags = {}
        if timestamp is None:
            timestamp = int((self.start + datetime.timedelta(minutes=1)).timestamp())
        if not isinstance(value, list):
            value = [value]
        self._send_buckets(
            [
                {
                    "org_id": self.organization_id,
                    "project_id": self.project.id,
                    "metric_id": indexer.resolve(metric),
                    "timestamp": timestamp,
                    "tags": tags,
                    # First letter of the entity
                    "type": entity[8],
                    "value": value,
                    "retention_days": 90,
                }
            ],
            entity=entity,
        )

    def test_default_conditions(self):
        query = MetricsQueryBuilder(self.params, "", selected_columns=[])
        self.assertCountEqual(query.where, self.default_conditions)

    def test_simple_aggregates(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            selected_columns=[
                "p50(transaction.duration)",
                "p75(measurements.lcp)",
                "p90(measurements.fcp)",
                "p95(measurements.cls)",
                "p99(measurements.fid)",
            ],
        )
        self.assertCountEqual(query.where, self.default_conditions)
        self.assertCountEqual(
            query.distributions,
            [
                _metric_percentile_definition("50"),
                _metric_percentile_definition("75", "measurements.lcp"),
                _metric_percentile_definition("90", "measurements.fcp"),
                _metric_percentile_definition("95", "measurements.cls"),
                _metric_percentile_definition("99", "measurements.fid"),
            ],
        )

    def test_grouping(self):
        query = MetricsQueryBuilder(
            self.params,
            "",
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        self.assertCountEqual(query.where, self.default_conditions)
        transaction_index = indexer.resolve("transaction")
        transaction = AliasedExpression(
            Column(f"tags[{transaction_index}]"),
            "transaction",
        )
        project = Function(
            "transform",
            [
                Column("project_id"),
                [self.project.id],
                [self.project.slug],
                "",
            ],
            "project",
        )
        self.assertCountEqual(
            query.groupby,
            [
                transaction,
                project,
            ],
        )
        self.assertCountEqual(query.distributions, [_metric_percentile_definition("95")])

    def test_transaction_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            "transaction:foo_transaction",
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        transaction_index = indexer.resolve("transaction")
        transaction_name = indexer.resolve("foo_transaction")
        transaction = Column(f"tags[{transaction_index}]")
        self.assertCountEqual(
            query.where, [*self.default_conditions, Condition(transaction, Op.EQ, transaction_name)]
        )

    def test_project_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        self.assertCountEqual(
            query.where,
            [*self.default_conditions, Condition(Column("project_id"), Op.EQ, self.project.id)],
        )

    def test_run_query(self):
        self.store_metric(
            100, tags={indexer.resolve("transaction"): indexer.resolve("foo_transaction")}
        )
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            selected_columns=[
                "transaction",
                "p95(transaction.duration)",
            ],
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": indexer.resolve("foo_transaction"),
            "p95_transaction_duration": 100,
        }

    def test_run_query_with_multiple_groupby(self):
        query = MetricsQueryBuilder(
            self.params,
            f"project:{self.project.slug}",
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="-p95(transaction.duration)",
        )
        self.store_metric(
            100, tags={indexer.resolve("transaction"): indexer.resolve("foo_transaction")}
        )
        self.store_metric(
            1,
            metric=constants.METRICS_MAP["user"],
            entity="metrics_sets",
            tags={indexer.resolve("transaction"): indexer.resolve("foo_transaction")},
        )
        self.store_metric(
            50, tags={indexer.resolve("transaction"): indexer.resolve("bar_transaction")}
        )
        self.store_metric(
            1,
            metric=constants.METRICS_MAP["user"],
            entity="metrics_sets",
            tags={indexer.resolve("transaction"): indexer.resolve("bar_transaction")},
        )
        self.store_metric(
            2,
            metric=constants.METRICS_MAP["user"],
            entity="metrics_sets",
            tags={indexer.resolve("transaction"): indexer.resolve("bar_transaction")},
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": indexer.resolve("foo_transaction"),
            "project": self.project.slug,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        assert result["data"][1] == {
            "transaction": indexer.resolve("bar_transaction"),
            "project": self.project.slug,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }
