import datetime
import string
from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from snuba_sdk import Column, Function
from snuba_sdk.conditions import Condition, Op

from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import TRACE_PARENT_SPAN_CONTEXT
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data


def random_transactions_snuba_query(
    query, requested_sample_size, updated_start_time, updated_end_time, project
):
    query_builder = QueryBuilder(
        Dataset.Discover,
        selected_columns=[
            "id",
            "trace",
            "random_number() AS rand_num",
            "modulo(rand_num, 10) as modulo_num",
        ],
        query=f"{query} event.type:transaction",
        params={
            "start": updated_start_time,
            "end": updated_end_time,
            "project_id": [project.id],
            "organization_id": project.organization.id,
        },
        offset=0,
        orderby=None,
        limit=requested_sample_size,
        equations=[],
        auto_fields=True,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        functions_acl=["random_number", "modulo"],
    )

    query_builder.add_conditions([Condition(lhs=Column("modulo_num"), op=Op.EQ, rhs=0)])
    snuba_query = query_builder.get_snql_query().query

    extra_select = [
        Function("has", [Column("contexts.key"), TRACE_PARENT_SPAN_CONTEXT], alias="is_root")
    ]
    snuba_query = snuba_query.set_select(snuba_query.select + extra_select)

    groupby = snuba_query.groupby + [Column("modulo_num"), Column("contexts.key")]
    snuba_query = snuba_query.set_groupby(groupby)

    return snuba_query


def project_stats_snuba_query(query, updated_start_time, updated_end_time, project, trace_ids):
    builder = QueryBuilder(
        Dataset.Discover,
        params={
            "start": updated_start_time,
            "end": updated_end_time,
            "organization_id": project.organization.id,
        },
        query=f"{query} event.type:transaction trace:[{','.join(trace_ids)}]",
        selected_columns=[
            "project_id",
            "project",
            "count()",
        ],
        equations=[],
        orderby=None,
        auto_fields=True,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        limit=20,
        offset=0,
        equation_config={"auto_add": False},
    )
    snuba_query = builder.get_snql_query().query
    extra_select = [
        Function(
            "countIf",
            [
                Function(
                    "not",
                    [Function("has", [Column("contexts.key"), TRACE_PARENT_SPAN_CONTEXT])],
                )
            ],
            alias="root_count",
        )
    ]
    snuba_query = snuba_query.set_select(snuba_query.select + extra_select)

    return snuba_query


@region_silo_test
class ProjectDynamicSamplingDistributionTest(APITestCase):
    @property
    def endpoint(self):
        return reverse(
            "sentry-api-0-project-dynamic-sampling-distribution",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_permission(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(self.endpoint)
            assert response.status_code == 403

    def test_feature_flag_disabled(self):
        self.login_as(self.user)
        response = self.client.get(self.endpoint)
        assert response.status_code == 404

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_response_when_no_transactions_are_available_in_last_month(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [{"data": [{"count()": 0}]}]
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "projectBreakdown": None,
                "parentProjectBreakdown": [],
                "sampleSize": 0,
                "startTimestamp": None,
                "endTimestamp": None,
            }

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_response_too_many_projects_in_the_breakdown(self, mock_query, mock_querybuilder):
        self.login_as(self.user)
        mock_query.side_effect = [
            {"data": [{"count()": 100}]},
        ]
        mock_querybuilder.side_effect = [
            {
                "data": [
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "random_number() AS random_number": 4255299100,
                        "is_root": 1,
                    },
                ]
            },
            {
                "data": [
                    {"project_id": 29 + idx, "project": project, "count": 3, "root_count": 3}
                    for idx, project in enumerate(list(string.ascii_lowercase)[0:11])
                ]
            },
        ]
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "detail": "Way too many projects in the distributed trace's project breakdown"
            }


@region_silo_test
class ProjectDynamicSamplingDistributionQueryCallsTest(APITestCase):
    def generate_fetch_transactions_count_query(
        self,
        query,
        start_time,
        end_time,
        requested_sample_size,
        extra_call_trace_ids=None,
    ):
        calls = [
            mock.call(
                selected_columns=[
                    "count()",
                ],
                query=f"{query} event.type:transaction",
                params={
                    "start": start_time,
                    "end": end_time,
                    "project_id": [self.project.id],
                    "organization_id": self.project.organization.id,
                },
                orderby=[],
                offset=0,
                limit=requested_sample_size,
                equations=[],
                auto_fields=True,
                auto_aggregations=True,
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
                transform_alias_to_input_format=True,
                functions_acl=None,
                referrer="dynamic-sampling.distribution.fetch-transactions-count",
            ),
        ]
        if extra_call_trace_ids is not None:
            calls.append(
                mock.call(
                    selected_columns=[
                        "project_id",
                        "project",
                        "count()",
                    ],
                    query=f"{query} event.type:transaction trace:[{','.join(extra_call_trace_ids)}]",
                    params={
                        "start": start_time,
                        "end": end_time,
                        "organization_id": self.project.organization.id,
                    },
                    orderby=[],
                    offset=0,
                    limit=20,
                    equations=[],
                    auto_fields=True,
                    auto_aggregations=True,
                    allow_metric_aggregates=True,
                    use_aggregate_conditions=True,
                    transform_alias_to_input_format=True,
                    functions_acl=None,
                    referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_BREAKDOWN.value,
                )
            )
        return calls

    @staticmethod
    def snuba_sort_key(elem):
        if isinstance(elem, Condition):
            try:
                return elem.lhs.name
            except AttributeError:
                return elem.lhs.function
        elif isinstance(elem, Column):
            return elem.name
        else:
            return elem.alias

    @property
    def endpoint(self):
        return reverse(
            "sentry-api-0-project-dynamic-sampling-distribution",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def assert_mocked_query_calls(
        self, snuba_query_random_transactions, snuba_query_project_stats, expected_calls
    ):
        for idx, snuba_query in enumerate(
            (snuba_query_random_transactions, snuba_query_project_stats)
        ):
            mock_querybuilder_query = expected_calls.call_args_list[idx][0][0].query
            assert sorted(mock_querybuilder_query.select, key=self.snuba_sort_key) == sorted(
                snuba_query.select, key=self.snuba_sort_key
            )
            assert sorted(mock_querybuilder_query.where, key=self.snuba_sort_key) == sorted(
                snuba_query.where, key=self.snuba_sort_key
            )
            assert sorted(mock_querybuilder_query.groupby, key=self.snuba_sort_key) == sorted(
                snuba_query.groupby, key=self.snuba_sort_key
            )

    @freeze_time()
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_queries_when_requested_project_is_head_of_trace(self, mock_query, mock_querybuilder):
        """
        Case A: Requesting for a project (bar) that is root but is a head of distributed traces
        Example of smart query response (DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS):
        |---------+-------+------|
        | project | count | root |
        |---------+-------+------|
        | bar     | 100   | 100  |
        | heart   | 5     | 0    |
        | water   | 10    | 0    |
        |---------+-------+------|
        """
        # Case A: Head of trace project
        self.login_as(self.user)
        heart = self.create_project(
            name="Heart", slug="heart", teams=[self.team], fire_project_created=True
        )
        mock_query.side_effect = [
            {"data": [{"count()": 1000}]},
        ]
        mock_querybuilder.side_effect = [
            {
                "data": [
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "random_number() AS random_number": 4255299100,
                        "is_root": 1,
                    },
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "0b127a578f8440c793f9ba1de595229f",
                        "random_number() AS random_number": 3976019453,
                        "is_root": 1,
                    },
                ]
            },
            {
                "data": [
                    {
                        "project": self.project.slug,
                        "project_id": self.project.id,
                        "count": 2,
                        "root_count": 2,
                    },
                    {
                        "project": heart.slug,
                        "project_id": heart.id,
                        "count": 1,
                        "root_count": 0,
                    },
                ]
            },
        ]
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=1)
        query = "environment:dev"
        requested_sample_size = 2

        calls = self.generate_fetch_transactions_count_query(
            query, start_time, end_time, requested_sample_size
        )

        snuba_query_random_transactions = random_transactions_snuba_query(
            query, requested_sample_size, start_time, end_time, self.project
        )
        snuba_query_project_stats = project_stats_snuba_query(
            query,
            start_time,
            end_time,
            self.project,
            trace_ids=["6503ee33b7bc43aead1facaa625a5dba"] * 2,
        )

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls
            assert len(mock_querybuilder.call_args_list) == 2
            self.assert_mocked_query_calls(
                snuba_query_random_transactions, snuba_query_project_stats, mock_querybuilder
            )

            response_data = response.json()
            assert response_data["projectBreakdown"] == [
                {"project_id": self.project.id, "project": self.project.slug, "count()": 2},
                {"project_id": heart.id, "project": heart.slug, "count()": 1},
            ]
            assert response_data["parentProjectBreakdown"] == [
                {"project": self.project.slug, "projectId": self.project.id, "percentage": 1.0}
            ]

    @freeze_time()
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_queries_when_requested_project_is_head_of_trace_and_non_root_in_others(
        self, mock_query, mock_querybuilder
    ):
        """
        Case B: Requesting for a project (bar) that is the head of trace for some distributed traces but also is
        non-root for some other distributed traces
        Example of smart query response (DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS):
        |---------+-------+------|
        | project | count | root |
        |---------+-------+------|
        | bar     | 15    | 10   |
        | heart   | 100   | 100  |
        | water   | 10    | 0    |
        |---------+-------+------|
        """
        # Case B: Head of trace project in some distributed trace and non-root in others
        self.login_as(self.user)
        heart = self.create_project(
            name="Heart", slug="heart", teams=[self.team], fire_project_created=True
        )
        wind = self.create_project(
            name="Wind", slug="wind", teams=[self.team], fire_project_created=True
        )

        mock_query.side_effect = [
            {"data": [{"count()": 1000}]},
            {
                "data": [
                    {"project_id": self.project.id, "project": self.project.slug, "count()": 1},
                    {"project_id": heart.id, "project": heart.slug, "count()": 1},
                ]
            },
        ]
        mock_querybuilder.side_effect = [
            {
                "data": [
                    # bar -> heart
                    # wind -> bar -> heart
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "random_number() AS random_number": 4255299100,
                        "is_root": 1,
                    },
                    {
                        "trace": "7633ee33b7bc43aead1facaa625a5dba",
                        "id": "23127a578f8440c793f9ba1de595223d",
                        "random_number() AS random_number": 4255200100,
                        "is_root": 0,
                    },
                ]
            },
            {
                "data": [
                    {
                        "project": self.project.slug,
                        "project_id": self.project.id,
                        "count": 2,
                        "root_count": 1,
                    },
                    {
                        "project": heart.slug,
                        "project_id": heart.id,
                        "count": 2,
                        "root_count": 0,
                    },
                    {
                        "project": wind.slug,
                        "project_id": wind.id,
                        "count": 1,
                        "root_count": 1,
                    },
                ]
            },
        ]
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=1)
        query = "environment:dev"
        requested_sample_size = 2

        calls = self.generate_fetch_transactions_count_query(
            query,
            start_time,
            end_time,
            requested_sample_size,
            extra_call_trace_ids=["6503ee33b7bc43aead1facaa625a5dba"],
        )

        snuba_query_random_transactions = random_transactions_snuba_query(
            query, requested_sample_size, start_time, end_time, self.project
        )
        snuba_query_project_stats = project_stats_snuba_query(
            query,
            start_time,
            end_time,
            self.project,
            trace_ids=["6503ee33b7bc43aead1facaa625a5dba", "7633ee33b7bc43aead1facaa625a5dba"],
        )

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls
            assert len(mock_querybuilder.call_args_list) == 2
            self.assert_mocked_query_calls(
                snuba_query_random_transactions, snuba_query_project_stats, mock_querybuilder
            )

            response_data = response.json()
            assert response_data["projectBreakdown"] == [
                {"project_id": self.project.id, "project": self.project.slug, "count()": 1},
                {"project_id": heart.id, "project": heart.slug, "count()": 1},
            ]
            assert response_data["parentProjectBreakdown"] == [
                {"project": self.project.slug, "projectId": self.project.id, "percentage": 0.5},
                {"project": wind.slug, "projectId": wind.id, "percentage": 0.5},
            ]

    @freeze_time()
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_queries_when_requested_project_is_not_head_of_trace(
        self, mock_query, mock_querybuilder
    ):
        """
        Case C: Requesting for a project (bar) that is part of a distributed trace but is not root
        Example of smart query response (DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS):
        |---------+-------+------|
        | project | count | root |
        |---------+-------+------|
        | bar     | 10    | 0    |
        | heart   | 100   | 100  |
        | water   | 5     | 0    |
        |---------+-------+------|
        """
        # Case C: request project not head of trace project
        self.login_as(self.user)
        heart = self.create_project(
            name="Heart", slug="heart", teams=[self.team], fire_project_created=True
        )
        mock_query.side_effect = [
            {"data": [{"count()": 1000}]},
        ]
        mock_querybuilder.side_effect = [
            {
                "data": [
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "random_number() AS random_number": 4255299100,
                        "is_root": 0,
                    },
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "0b127a578f8440c793f9ba1de595229f",
                        "random_number() AS random_number": 3976019453,
                        "is_root": 0,
                    },
                ]
            },
            {
                "data": [
                    {
                        "project": self.project.slug,
                        "project_id": self.project.id,
                        "count": 2,
                        "root_count": 0,
                    },
                    {
                        "project": heart.slug,
                        "project_id": heart.id,
                        "count": 2,
                        "root_count": 2,
                    },
                ]
            },
        ]
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=1)
        query = "environment:dev"
        requested_sample_size = 2

        calls = self.generate_fetch_transactions_count_query(
            query, start_time, end_time, requested_sample_size
        )

        snuba_query_random_transactions = random_transactions_snuba_query(
            query, requested_sample_size, start_time, end_time, self.project
        )
        snuba_query_project_stats = project_stats_snuba_query(
            query,
            start_time,
            end_time,
            self.project,
            trace_ids=["6503ee33b7bc43aead1facaa625a5dba"] * 2,
        )

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls
            assert len(mock_querybuilder.call_args_list) == 2
            self.assert_mocked_query_calls(
                snuba_query_random_transactions, snuba_query_project_stats, mock_querybuilder
            )

            response_data = response.json()
            assert response_data["projectBreakdown"] == []
            assert response_data["parentProjectBreakdown"] == [
                {"project": heart.slug, "projectId": heart.id, "percentage": 1.0}
            ]

    @freeze_time()
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_queries_when_single_project(self, mock_query, mock_querybuilder):
        """
        Case D: Requesting for a single project (bar - distributed tracing is disabled)
        Example of smart query response (DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS):
        |---------+-------+------|
        | project | count | root |
        |---------+-------+------|
        | bar     | 100   | 100  |
        |---------+-------+------|
        """
        # Case D: Single project
        self.login_as(self.user)

        mock_query.side_effect = [{"data": [{"count()": 1000}]}]
        mock_querybuilder.side_effect = [
            {
                "data": [
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "project": self.project.slug,
                        "random_number() AS random_number": 4255299100,
                        "is_root": 1,
                    },
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "0b127a578f8440c793f9ba1de595229f",
                        "project": self.project.slug,
                        "random_number() AS random_number": 3976019453,
                        "is_root": 1,
                    },
                ]
            },
            {
                "data": [
                    {
                        "project": self.project.slug,
                        "project_id": self.project.id,
                        "count": 2,
                        "root_count": 2,
                    }
                ]
            },
        ]
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=1)
        query = "environment:dev"
        requested_sample_size = 2

        calls = self.generate_fetch_transactions_count_query(
            query, start_time, end_time, requested_sample_size
        )
        snuba_query_random_transactions = random_transactions_snuba_query(
            query, requested_sample_size, start_time, end_time, self.project
        )
        snuba_query_project_stats = project_stats_snuba_query(
            query,
            start_time,
            end_time,
            self.project,
            trace_ids=["6503ee33b7bc43aead1facaa625a5dba"] * 2,
        )

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls
            assert len(mock_querybuilder.call_args_list) == 2
            self.assert_mocked_query_calls(
                snuba_query_random_transactions, snuba_query_project_stats, mock_querybuilder
            )
            response_data = response.json()
            assert response_data["projectBreakdown"] == [
                {"project_id": self.project.id, "project": self.project.slug, "count()": 2},
            ]
            assert response_data["parentProjectBreakdown"] == [
                {"project": self.project.slug, "projectId": self.project.id, "percentage": 1.0}
            ]

    @freeze_time("2022-08-18T11:00:0.000000Z")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_path_when_no_transactions_in_last_hour(self, mock_query, mock_querybuilder):
        self.login_as(self.user)
        mock_query.side_effect = [
            {"data": [{"count()": 0}]},
            {
                "data": [
                    {"timestamp.to_day": "2022-08-06T00:00:00+00:00", "count()": 1000},
                ]
            },
        ]
        mock_querybuilder.side_effect = [
            {
                "data": [
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "random_number() AS random_number": 4255299100,
                        "is_root": 1,
                    },
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "0b127a578f8440c793f9ba1de595229f",
                        "random_number() AS random_number": 3976019453,
                        "is_root": 1,
                    },
                ]
            },
            {
                "data": [
                    {
                        "project": self.project.slug,
                        "project_id": self.project.id,
                        "count": 2,
                        "root_count": 2,
                    }
                ]
            },
        ]
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=1)
        query = "environment:dev"
        requested_sample_size = 2

        updated_start_time = datetime.datetime(2022, 8, 6, 0, 0, 0, tzinfo=timezone.utc)
        updated_end_time = datetime.datetime(2022, 8, 7, 0, 0, 0, tzinfo=timezone.utc)

        end_bound_time = end_time.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
            days=1
        )
        start_bound_time = end_bound_time - timedelta(days=30)

        calls = self.generate_fetch_transactions_count_query(
            query, start_time, end_time, requested_sample_size
        ) + [
            mock.call(
                selected_columns=["count()", "timestamp.to_day"],
                query=f"{query} event.type:transaction",
                params={
                    "start": start_bound_time,
                    "end": end_bound_time,
                    "project_id": [self.project.id],
                    "organization_id": self.project.organization.id,
                },
                orderby=["-timestamp.to_day"],
                offset=0,
                limit=1,
                equations=[],
                auto_fields=True,
                auto_aggregations=True,
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
                transform_alias_to_input_format=True,
                functions_acl=None,
                referrer="dynamic-sampling.distribution.get-most-recent-day-with-transactions",
            ),
        ]
        snuba_query_random_transactions = random_transactions_snuba_query(
            query, requested_sample_size, updated_start_time, updated_end_time, self.project
        )
        snuba_query_project_stats = project_stats_snuba_query(
            query,
            updated_start_time,
            updated_end_time,
            self.project,
            trace_ids=["6503ee33b7bc43aead1facaa625a5dba"] * 2,
        )

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls

            self.assert_mocked_query_calls(
                snuba_query_random_transactions, snuba_query_project_stats, mock_querybuilder
            )
            response_data = response.json()
            assert response_data["projectBreakdown"] == [
                {"project_id": self.project.id, "project": self.project.slug, "count()": 2},
            ]
            assert response_data["parentProjectBreakdown"] == [
                {"project": self.project.slug, "projectId": self.project.id, "percentage": 1.0}
            ]


class ProjectDynamicSamplingDistributionIntegrationTest(SnubaTestCase, APITestCase):
    # ToDo: Add tests for other cases A, C and D + case when no transactions in last hour but in last 30 days + test
    #  case when no transactions in last 30 days
    @property
    def endpoint(self):
        return reverse(
            "sentry-api-0-project-dynamic-sampling-distribution",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def create_transaction(
        self,
        transaction,
        trace_id,
        span_id,
        spans,
        project_id,
        start_timestamp,
        duration,
        parent_span_id=None,
        transaction_id=None,
        is_root=False,
    ):
        timestamp = start_timestamp + timedelta(milliseconds=duration)

        data = load_data(
            "transaction",
            trace=trace_id,
            span_id=span_id,
            spans=spans,
            start_timestamp=start_timestamp,
            timestamp=timestamp,
        )
        if transaction_id is not None:
            data["event_id"] = transaction_id
        data["transaction"] = transaction
        if parent_span_id is not None:
            data["contexts"]["trace"]["parent_span_id"] = parent_span_id
        if is_root:
            data["contexts"]["trace"] = {"type": "trace", "trace_id": trace_id, "span_id": span_id}
        return self.store_event(data, project_id=project_id)

    @freeze_time()
    def test_queries_when_requested_project_is_head_of_trace_and_non_root_in_others(
        self,
    ):
        """
        Case B: Requesting for a project (bar) that is the head of trace for some distributed traces but also is
        non-root for some other distributed traces
        Example of smart query response (DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS):
        |---------+-------+------|
        | project | count | root |
        |---------+-------+------|
        | bar     | 15    | 10   |
        | heart   | 100   | 100  |
        | water   | 10    | 0    |
        |---------+-------+------|
        """
        # Case B: Head of trace project in some distributed trace and non-root in others
        self.login_as(self.user)
        heart = self.create_project(
            name="Heart", slug="heart", teams=[self.team], fire_project_created=True
        )
        wind = self.create_project(
            name="Wind", slug="wind", teams=[self.team], fire_project_created=True
        )

        # bar -> heart
        self.create_transaction(
            transaction="bar_transaction",
            trace_id="a" * 32,
            span_id="b" * 16,
            parent_span_id=None,
            spans=None,
            project_id=self.project.id,
            start_timestamp=before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0),
            duration=800,
            is_root=True,
        )
        self.create_transaction(
            transaction="heart_transaction",
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="b" * 16,
            spans=None,
            project_id=heart.id,
            start_timestamp=before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0),
            duration=800,
        )
        # wind -> bar -> heart
        self.create_transaction(
            transaction="wind_transaction",
            trace_id="b" * 32,
            span_id="d" * 16,
            parent_span_id=None,
            spans=None,
            project_id=wind.id,
            start_timestamp=before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0),
            duration=800,
            is_root=True,
        )
        self.create_transaction(
            transaction="bar_non_root_transaction",
            trace_id="b" * 32,
            span_id="e" * 16,
            parent_span_id="d" * 16,
            spans=None,
            project_id=self.project.id,
            start_timestamp=before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0),
            duration=800,
        )
        self.create_transaction(
            transaction="heart_transaction",
            trace_id="b" * 32,
            span_id="f" * 16,
            parent_span_id="e" * 16,
            spans=None,
            project_id=heart.id,
            start_timestamp=before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0),
            duration=800,
        )
        requested_sample_size = 2

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize={requested_sample_size}")
            response_data = response.json()
            assert sorted(
                response_data["projectBreakdown"], key=lambda elem: elem["project"]
            ) == sorted(
                [
                    {"project_id": self.project.id, "project": self.project.slug, "count()": 1},
                    {"project_id": heart.id, "project": heart.slug, "count()": 1},
                ],
                key=lambda elem: elem["project"],
            )
            assert sorted(
                response_data["parentProjectBreakdown"], key=lambda elem: elem["project"]
            ) == sorted(
                [
                    {"project": self.project.slug, "projectId": self.project.id, "percentage": 0.5},
                    {"project": wind.slug, "projectId": wind.id, "percentage": 0.5},
                ],
                key=lambda elem: elem["project"],
            )
