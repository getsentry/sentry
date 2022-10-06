import datetime
from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from snuba_sdk import Column
from snuba_sdk.conditions import Condition, Op

from sentry.models import Project
from sentry.search.events.builder import QueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


def mocked_query_builder_query(referrer):
    if referrer == "dynamic-sampling.distribution.fetch-parent-transactions":
        return {
            "data": [
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                    "project.name": "fire",
                    "random_number() AS random_number": 4255299100,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b127a578f8440c793f9ba1de595229f",
                    "project.name": "fire",
                    "random_number() AS random_number": 3976019453,
                },
                {
                    "trace": "9f1a4413544f4d2d9cef4fe109ec426c",
                    "id": "4d3058e9b3094dcebfdf318d5c025931",
                    "project.name": "fire",
                    "random_number() AS random_number": 3941410921,
                },
                {
                    "trace": "06f91ed13ce042f58f848a11bd26ba3c",
                    "id": "c3bc0378a08249158d46e36f3dd1cc49",
                    "project.name": "fire",
                    "random_number() AS random_number": 3877259197,
                },
                {
                    "trace": "1f9f55e795f843efbf53a3eb84602c56",
                    "id": "9d45de8df2d74e5ea8237e694d39c742",
                    "project.name": "fire",
                    "random_number() AS random_number": 3573364680,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "e861796cea8242338981b2b43aa1b88a",
                    "project.name": "fire",
                    "random_number() AS random_number": 3096490437,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "aac21853bbe746a794303a8f26ec0ac3",
                    "project.name": "fire",
                    "random_number() AS random_number": 2311382371,
                },
                {
                    "trace": "05578079ff5848bdb27c50f70687ee0b",
                    "id": "060faa37691a48fb95ec2e3e4c06142a",
                    "project.name": "fire",
                    "random_number() AS random_number": 2211686055,
                },
                {
                    "trace": "05578079ff5848bdb27c50f70687ee0b",
                    "id": "ae563f50cfb34f5d8d0b3c32f744dace",
                    "project.name": "fire",
                    "random_number() AS random_number": 2192550125,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "5fdeddd215e6410f83ffad9087f966e8",
                    "project.name": "fire",
                    "random_number() AS random_number": 2175797883,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0ff7bdf09ddf427b89cc6892a0909ba0",
                    "project.name": "fire",
                    "random_number() AS random_number": 2142152502,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "9514c862fddb4686baac0477f4bd81db",
                    "project.name": "fire",
                    "random_number() AS random_number": 1863063737,
                },
                {
                    "trace": "c6e5dd7caeef4d6d8320b2d431fcaf1c",
                    "id": "02b3325de01f4e4ca85f4ca26904141d",
                    "project.name": "fire",
                    "random_number() AS random_number": 1764088972,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "712221220ff04138986905bb42c04bdf",
                    "project.name": "fire",
                    "random_number() AS random_number": 1637151306,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b9eb3872cab4dddaed850ab3d9c1882",
                    "project.name": "fire",
                    "random_number() AS random_number": 1500459010,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "27d80cd631574d349345cbd21bf89bcd",
                    "project.name": "fire",
                    "random_number() AS random_number": 732695464,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "95c1ca5655ca4ddbb8421282abbaf950",
                    "project.name": "fire",
                    "random_number() AS random_number": 523157974,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0bcf9d68b50544d0a4369586aad0721f",
                    "project.name": "fire",
                    "random_number() AS random_number": 283786475,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "da9b8f0f8e3c48f8af452a4def0dc356",
                    "project.name": "fire",
                    "random_number() AS random_number": 259256656,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "7aa51f558a8c411793fe28d6fbc6ba55",
                    "project.name": "fire",
                    "random_number() AS random_number": 171492976,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "5c7c7eca495842e39744196851edd947",
                    "project.name": "fire",
                    "random_number() AS random_number": 121455970,
                },
            ]
        }
    raise Exception("Something went wrong!")


def mocked_discover_query(referrer):
    if referrer == "dynamic-sampling.distribution.fetch-parent-transactions-count":
        return {"data": [{"count()": 100}]}
    elif referrer == "dynamic-sampling.distribution.fetch-project-breakdown":
        return {
            "data": [
                {"project_id": 27, "project": "earth", "count()": 34},
                {"project_id": 28, "project": "heart", "count()": 3},
                {"project_id": 24, "project": "water", "count()": 3},
                {"project_id": 23, "project": "wind", "count()": 3},
                {"project_id": 25, "project": "fire", "count()": 21},
            ]
        }
    raise Exception("Something went wrong!")


@region_silo_test
class ProjectDynamicSamplingTest(APITestCase):
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

    @freeze_time("2022-08-18T11:00:0.000000Z")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_successful_response_with_distributed_traces(self, mock_query, mock_querybuilder):
        self.login_as(self.user)
        mock_query.side_effect = [
            mocked_discover_query("dynamic-sampling.distribution.fetch-parent-transactions-count"),
            mocked_discover_query("dynamic-sampling.distribution.fetch-project-breakdown"),
        ]
        mock_querybuilder.return_value = mocked_query_builder_query(
            referrer="dynamic-sampling.distribution.fetch-parent-transactions"
        )
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(self.endpoint)
            assert response.json() == {
                "projectBreakdown": [
                    {"project_id": 27, "project": "earth", "count()": 34},
                    {"project_id": 28, "project": "heart", "count()": 3},
                    {"project_id": 24, "project": "water", "count()": 3},
                    {"project_id": 23, "project": "wind", "count()": 3},
                    {"project_id": 25, "project": "fire", "count()": 21},
                ],
                "sampleSize": 21,
                "startTimestamp": "2022-08-18T10:00:00Z",
                "endTimestamp": "2022-08-18T11:00:00Z",
            }

    @freeze_time("2022-08-18T11:00:0.000000Z")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_successful_response_with_single_transactions(self, mock_query, mock_querybuilder):
        self.login_as(self.user)
        mock_query.side_effect = [
            mocked_discover_query("dynamic-sampling.distribution.fetch-parent-transactions-count"),
            mocked_discover_query("dynamic-sampling.distribution.fetch-project-breakdown"),
        ]
        mock_querybuilder.return_value = mocked_query_builder_query(
            referrer="dynamic-sampling.distribution.fetch-parent-transactions"
        )
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?distributedTrace=0")
            assert response.json() == {
                "projectBreakdown": None,
                "sampleSize": 21,
                "startTimestamp": "2022-08-18T10:00:00Z",
                "endTimestamp": "2022-08-18T11:00:00Z",
            }

    @freeze_time("2022-08-18T11:00:0.000000Z")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_successful_response_with_small_sample_size(self, mock_query, mock_querybuilder):
        self.login_as(self.user)
        mock_query.side_effect = [
            mocked_discover_query("dynamic-sampling.distribution.fetch-parent-transactions-count"),
            {
                "data": [
                    {"project_id": 25, "project": "fire", "count()": 2},
                ]
            },
        ]
        mock_querybuilder.return_value = {
            "data": [
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                    "project.name": "fire",
                    "random_number() AS random_number": 4255299100,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b127a578f8440c793f9ba1de595229f",
                    "project.name": "fire",
                    "random_number() AS random_number": 3976019453,
                },
            ]
        }

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "projectBreakdown": [
                    {"project_id": 25, "project": "fire", "count()": 2},
                ],
                "sampleSize": 2,
                "startTimestamp": "2022-08-18T10:00:00Z",
                "endTimestamp": "2022-08-18T11:00:00Z",
            }

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_response_when_no_transactions_are_available_in_last_month(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [{"data": [{"count()": 0}]}, {"data": []}]
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "projectBreakdown": None,
                "sampleSize": 0,
                "startTimestamp": None,
                "endTimestamp": None,
            }

    @freeze_time("2022-08-18T11:00:0.000000Z")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_response_when_no_transactions_are_available_in_last_day_only(
        self, mock_query, mock_querybuilder
    ):
        self.login_as(self.user)
        mock_query.side_effect = [
            {"data": [{"count()": 0}]},
            {
                "data": [
                    {"timestamp.to_day": "2022-08-06T00:00:00+00:00", "count()": 19},
                ]
            },
            {
                "data": [
                    {"project_id": 25, "project": "fire", "count()": 2},
                ]
            },
        ]
        mock_querybuilder.return_value = {
            "data": [
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                    "project.name": "fire",
                    "random_number() AS random_number": 4255299100,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b127a578f8440c793f9ba1de595229f",
                    "project.name": "fire",
                    "random_number() AS random_number": 3976019453,
                },
            ]
        }
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "projectBreakdown": [
                    {"project_id": 25, "project": "fire", "count()": 2},
                ],
                "sampleSize": 2,
                "startTimestamp": "2022-08-06T00:00:00Z",
                "endTimestamp": "2022-08-07T00:00:00Z",
            }

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_response_too_many_projects_in_the_breakdown(self, mock_query, mock_querybuilder):
        self.login_as(self.user)
        mock_query.side_effect = [
            mocked_discover_query("dynamic-sampling.distribution.fetch-parent-transactions-count"),
            {
                "data": [
                    {"project_id": 27, "project": "earth", "count()": 34},
                    {"project_id": 28, "project": "heart", "count()": 3},
                    {"project_id": 24, "project": "water", "count()": 3},
                    {"project_id": 23, "project": "wind", "count()": 3},
                    {"project_id": 25, "project": "fire", "count()": 21},
                    {"project_id": 21, "project": "air", "count()": 21},
                    {"project_id": 20, "project": "fire-air", "count()": 21},
                    {"project_id": 22, "project": "fire-water", "count()": 21},
                    {"project_id": 30, "project": "fire-earth", "count()": 21},
                    {"project_id": 31, "project": "fire-fire", "count()": 21},
                    {"project_id": 32, "project": "fire-heart", "count()": 21},
                ]
            },
        ]
        mock_querybuilder.return_value = mocked_query_builder_query(
            referrer="dynamic-sampling.distribution.fetch-parent-transactions"
        )
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "detail": "Way too many projects in the distributed trace's project breakdown"
            }

    @freeze_time()
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.raw_snql_query")
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_request_params_are_applied_to_discover_query(self, mock_query, mock_querybuilder):
        self.login_as(self.user)
        mock_query.side_effect = [
            {"data": [{"count()": 1000}]},
            {
                "data": [
                    {"project_id": 25, "project": "fire", "count()": 2},
                ]
            },
        ]
        mock_querybuilder.return_value = {
            "data": [
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                    "project.name": "fire",
                    "random_number() AS random_number": 4255299100,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b127a578f8440c793f9ba1de595229f",
                    "project.name": "fire",
                    "random_number() AS random_number": 3976019453,
                },
            ]
        }
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=1)
        query = "environment:dev"
        requested_sample_size = 2
        projects_in_org = Project.objects.filter(
            organization=self.project.organization
        ).values_list("id", flat=True)
        trace_id_list = ["6503ee33b7bc43aead1facaa625a5dba", "6503ee33b7bc43aead1facaa625a5dba"]

        calls = [
            mock.call(
                selected_columns=[
                    "count()",
                ],
                query=f"{query} event.type:transaction !has:trace.parent_span",
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
                referrer="dynamic-sampling.distribution.fetch-parent-transactions-count",
            ),
            mock.call(
                selected_columns=["project_id", "project", "count()"],
                query=f"event.type:transaction trace:[{','.join(trace_id_list)}]",
                params={
                    "start": start_time,
                    "end": end_time,
                    "project_id": list(projects_in_org),
                    "organization_id": self.project.organization.id,
                },
                equations=[],
                functions_acl=None,
                orderby=[],
                offset=0,
                limit=20,
                auto_fields=True,
                auto_aggregations=True,
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
                transform_alias_to_input_format=True,
                referrer="dynamic-sampling.distribution.fetch-project-breakdown",
            ),
        ]
        query_builder = QueryBuilder(
            Dataset.Discover,
            selected_columns=[
                "id",
                "trace",
                "random_number() AS rand_num",
                "modulo(rand_num, 10) as modulo_num",
            ],
            query=f"{query} event.type:transaction !has:trace.parent_span",
            params={
                "start": start_time,
                "end": end_time,
                "project_id": [self.project.id],
                "organization_id": self.project.organization.id,
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
        groupby = snuba_query.groupby + [Column("modulo_num")]
        snuba_query = snuba_query.set_groupby(groupby)

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls

            mock_querybuilder_query = mock_querybuilder.call_args_list[0][0][0].query

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

            assert sorted(mock_querybuilder_query.select, key=snuba_sort_key) == sorted(
                snuba_query.select, key=snuba_sort_key
            )
            assert sorted(mock_querybuilder_query.where, key=snuba_sort_key) == sorted(
                snuba_query.where, key=snuba_sort_key
            )
            assert sorted(mock_querybuilder_query.groupby, key=snuba_sort_key) == sorted(
                snuba_query.groupby, key=snuba_sort_key
            )

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
            {
                "data": [
                    {"project_id": 25, "project": "fire", "count()": 2},
                ]
            },
        ]
        mock_querybuilder.return_value = {
            "data": [
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                    "project.name": "fire",
                    "random_number() AS random_number": 4255299100,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b127a578f8440c793f9ba1de595229f",
                    "project.name": "fire",
                    "random_number() AS random_number": 3976019453,
                },
            ]
        }
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=1)
        query = "environment:dev"
        requested_sample_size = 2
        projects_in_org = Project.objects.filter(
            organization=self.project.organization
        ).values_list("id", flat=True)
        trace_id_list = ["6503ee33b7bc43aead1facaa625a5dba", "6503ee33b7bc43aead1facaa625a5dba"]

        updated_start_time = datetime.datetime(2022, 8, 6, 0, 0, 0, tzinfo=timezone.utc)
        updated_end_time = datetime.datetime(2022, 8, 7, 0, 0, 0, tzinfo=timezone.utc)

        end_bound_time = end_time.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
            days=1
        )
        start_bound_time = end_bound_time - timedelta(days=30)

        calls = [
            mock.call(
                selected_columns=[
                    "count()",
                ],
                query=f"{query} event.type:transaction !has:trace.parent_span",
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
                referrer="dynamic-sampling.distribution.fetch-parent-transactions-count",
            ),
            mock.call(
                selected_columns=["count()", "timestamp.to_day"],
                query=f"{query} event.type:transaction !has:trace.parent_span",
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
            mock.call(
                selected_columns=["project_id", "project", "count()"],
                query=f"event.type:transaction trace:[{','.join(trace_id_list)}]",
                params={
                    "start": updated_start_time,
                    "end": updated_end_time,
                    "project_id": list(projects_in_org),
                    "organization_id": self.project.organization.id,
                },
                equations=[],
                functions_acl=None,
                orderby=[],
                offset=0,
                limit=20,
                auto_fields=True,
                auto_aggregations=True,
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
                transform_alias_to_input_format=True,
                referrer="dynamic-sampling.distribution.fetch-project-breakdown",
            ),
        ]
        query_builder = QueryBuilder(
            Dataset.Discover,
            selected_columns=[
                "id",
                "trace",
                "random_number() AS rand_num",
                "modulo(rand_num, 10) as modulo_num",
            ],
            query=f"{query} event.type:transaction !has:trace.parent_span",
            params={
                "start": updated_start_time,
                "end": updated_end_time,
                "project_id": [self.project.id],
                "organization_id": self.project.organization.id,
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
        groupby = snuba_query.groupby + [Column("modulo_num")]
        snuba_query = snuba_query.set_groupby(groupby)

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls

            mock_querybuilder_query = mock_querybuilder.call_args_list[0][0][0].query

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

            assert sorted(mock_querybuilder_query.select, key=snuba_sort_key) == sorted(
                snuba_query.select, key=snuba_sort_key
            )
            assert sorted(mock_querybuilder_query.where, key=snuba_sort_key) == sorted(
                snuba_query.where, key=snuba_sort_key
            )
            assert sorted(mock_querybuilder_query.groupby, key=snuba_sort_key) == sorted(
                snuba_query.groupby, key=snuba_sort_key
            )
