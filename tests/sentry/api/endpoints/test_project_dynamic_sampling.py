from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Project
from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


def mocked_discover_query(referrer):
    if referrer == "dynamic-sampling.distribution.fetch-parent-transactions":
        return {
            "data": [
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 4255299100,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b127a578f8440c793f9ba1de595229f",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 3976019453,
                },
                {
                    "trace": "9f1a4413544f4d2d9cef4fe109ec426c",
                    "id": "4d3058e9b3094dcebfdf318d5c025931",
                    "trace.client_sample_rate": "0.9609190650573167",
                    "project.name": "fire",
                    "random_number() AS random_number": 3941410921,
                },
                {
                    "trace": "06f91ed13ce042f58f848a11bd26ba3c",
                    "id": "c3bc0378a08249158d46e36f3dd1cc49",
                    "trace.client_sample_rate": "0.8610195401441058",
                    "project.name": "fire",
                    "random_number() AS random_number": 3877259197,
                },
                {
                    "trace": "1f9f55e795f843efbf53a3eb84602c56",
                    "id": "9d45de8df2d74e5ea8237e694d39c742",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 3573364680,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "e861796cea8242338981b2b43aa1b88a",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 3096490437,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "aac21853bbe746a794303a8f26ec0ac3",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 2311382371,
                },
                {
                    "trace": "05578079ff5848bdb27c50f70687ee0b",
                    "id": "060faa37691a48fb95ec2e3e4c06142a",
                    "trace.client_sample_rate": "0.9545587106701261",
                    "project.name": "fire",
                    "random_number() AS random_number": 2211686055,
                },
                {
                    "trace": "05578079ff5848bdb27c50f70687ee0b",
                    "id": "ae563f50cfb34f5d8d0b3c32f744dace",
                    "trace.client_sample_rate": "0.811665375972728",
                    "project.name": "fire",
                    "random_number() AS random_number": 2192550125,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "5fdeddd215e6410f83ffad9087f966e8",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 2175797883,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0ff7bdf09ddf427b89cc6892a0909ba0",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 2142152502,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "9514c862fddb4686baac0477f4bd81db",
                    "trace.client_sample_rate": "0.9059899056468697",
                    "project.name": "fire",
                    "random_number() AS random_number": 1863063737,
                },
                {
                    "trace": "c6e5dd7caeef4d6d8320b2d431fcaf1c",
                    "id": "02b3325de01f4e4ca85f4ca26904141d",
                    "trace.client_sample_rate": "0.8096753824342516",
                    "project.name": "fire",
                    "random_number() AS random_number": 1764088972,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "712221220ff04138986905bb42c04bdf",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 1637151306,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0b9eb3872cab4dddaed850ab3d9c1882",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 1500459010,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "27d80cd631574d349345cbd21bf89bcd",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 732695464,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "95c1ca5655ca4ddbb8421282abbaf950",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 523157974,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "0bcf9d68b50544d0a4369586aad0721f",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 283786475,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "da9b8f0f8e3c48f8af452a4def0dc356",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 259256656,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "7aa51f558a8c411793fe28d6fbc6ba55",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 171492976,
                },
                {
                    "trace": "6503ee33b7bc43aead1facaa625a5dba",
                    "id": "5c7c7eca495842e39744196851edd947",
                    "trace.client_sample_rate": "",
                    "project.name": "fire",
                    "random_number() AS random_number": 121455970,
                },
            ]
        }
    else:
        return {
            "data": [
                {"project": "earth", "count()": 34},
                {"project": "heart", "count()": 3},
                {"project": "water", "count()": 3},
                {"project": "wind", "count()": 3},
                {"project": "fire", "count()": 21},
            ]
        }


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
        with Feature({"organizations:filters-and-sampling": True}):
            response = self.client.get(self.endpoint)
            assert response.status_code == 403

    def test_feature_flag_disabled(self):
        self.login_as(self.user)
        response = self.client.get(self.endpoint)
        assert response.status_code == 404

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_successful_response_with_distributed_traces(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [
            mocked_discover_query("dynamic-sampling.distribution.fetch-parent-transactions"),
            mocked_discover_query("whatever"),
        ]
        with Feature({"organizations:filters-and-sampling": True}):
            response = self.client.get(self.endpoint)
            assert response.json() == {
                "project_breakdown": [
                    {"project": "earth", "count()": 34},
                    {"project": "heart", "count()": 3},
                    {"project": "water", "count()": 3},
                    {"project": "wind", "count()": 3},
                    {"project": "fire", "count()": 21},
                ],
                "sample_size": 21,
                "null_sample_rate_percentage": 71.42857142857143,
                "sample_rate_distributions": {
                    "min": 0.8096753824342516,
                    "max": 0.9609190650573167,
                    "mean": 0.8839713299875663,
                    "p50": 0.9059899056468697,
                    "p90": 0.9609190650573167,
                    "p95": 0.9609190650573167,
                    "p99": 0.9609190650573167,
                },
            }

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_successful_response_with_single_transactions(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [
            mocked_discover_query("dynamic-sampling.distribution.fetch-parent-transactions"),
            mocked_discover_query("whatever"),
        ]
        with Feature({"organizations:filters-and-sampling": True}):
            response = self.client.get(f"{self.endpoint}?distributedTrace=0")
            assert response.json() == {
                "project_breakdown": None,
                "sample_size": 21,
                "null_sample_rate_percentage": 71.42857142857143,
                "sample_rate_distributions": {
                    "min": 0.8096753824342516,
                    "max": 0.9609190650573167,
                    "mean": 0.8839713299875663,
                    "p50": 0.9059899056468697,
                    "p90": 0.9609190650573167,
                    "p95": 0.9609190650573167,
                    "p99": 0.9609190650573167,
                },
            }

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_successful_response_with_small_sample_size(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [
            {
                "data": [
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "trace.client_sample_rate": "",
                        "project.name": "fire",
                        "random_number() AS random_number": 4255299100,
                    },
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "0b127a578f8440c793f9ba1de595229f",
                        "trace.client_sample_rate": "",
                        "project.name": "fire",
                        "random_number() AS random_number": 3976019453,
                    },
                ]
            },
            {
                "data": [
                    {"project": "fire", "count()": 2},
                ]
            },
        ]
        with Feature({"organizations:filters-and-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "project_breakdown": [
                    {"project": "fire", "count()": 2},
                ],
                "sample_size": 2,
                "null_sample_rate_percentage": 100.0,
                "sample_rate_distributions": {
                    "min": None,
                    "max": None,
                    "mean": None,
                    "p50": None,
                    "p90": None,
                    "p95": None,
                    "p99": None,
                },
            }

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_response_when_no_transactions_are_available(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [{"data": []}, {"data": []}]
        with Feature({"organizations:filters-and-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "project_breakdown": None,
                "sample_size": 0,
                "null_sample_rate_percentage": None,
                "sample_rate_distributions": None,
            }

    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_response_too_many_projects_in_the_breakdown(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [
            mocked_discover_query("dynamic-sampling.distribution.fetch-parent-transactions"),
            {
                "data": [
                    {"project": "earth", "count()": 34},
                    {"project": "heart", "count()": 3},
                    {"project": "water", "count()": 3},
                    {"project": "wind", "count()": 3},
                    {"project": "fire", "count()": 21},
                    {"project": "air", "count()": 21},
                    {"project": "fire-air", "count()": 21},
                    {"project": "fire-water", "count()": 21},
                    {"project": "fire-earth", "count()": 21},
                    {"project": "fire-fire", "count()": 21},
                    {"project": "fire-heart", "count()": 21},
                ]
            },
        ]
        with Feature({"organizations:filters-and-sampling": True}):
            response = self.client.get(f"{self.endpoint}?sampleSize=2")
            assert response.json() == {
                "details": "Way too many projects in the distributed trace's project breakdown"
            }

    @freeze_time()
    @mock.patch("sentry.api.endpoints.project_dynamic_sampling.discover.query")
    def test_request_params_are_applied_to_discover_query(self, mock_query):
        self.login_as(self.user)
        mock_query.side_effect = [
            {
                "data": [
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "6ddc83ee612b4e89b95b5278c8fd188f",
                        "trace.client_sample_rate": "",
                        "project.name": "fire",
                        "random_number() AS random_number": 4255299100,
                    },
                    {
                        "trace": "6503ee33b7bc43aead1facaa625a5dba",
                        "id": "0b127a578f8440c793f9ba1de595229f",
                        "trace.client_sample_rate": "",
                        "project.name": "fire",
                        "random_number() AS random_number": 3976019453,
                    },
                ]
            },
            {
                "data": [
                    {"project": "fire", "count()": 2},
                ]
            },
        ]
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=6)
        query = "environment:dev"
        requested_sample_size = 2
        projects_in_org = Project.objects.filter(
            organization=self.project.organization
        ).values_list("id", flat=True)
        trace_id_list = ["6503ee33b7bc43aead1facaa625a5dba", "6503ee33b7bc43aead1facaa625a5dba"]

        calls = [
            mock.call(
                selected_columns=[
                    "id",
                    "trace",
                    "trace.client_sample_rate",
                    "random_number() AS random_number",
                ],
                query=f"{query} event.type:transaction !has:trace.parent_span_id",
                params={
                    "start": start_time,
                    "end": end_time,
                    "project_id": [self.project.id],
                    "organization_id": self.project.organization,
                },
                orderby=["-random_number"],
                offset=0,
                limit=requested_sample_size,
                equations=[],
                auto_fields=True,
                auto_aggregations=True,
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
                transform_alias_to_input_format=True,
                functions_acl=["random_number"],
                referrer="dynamic-sampling.distribution.fetch-parent-transactions",
            ),
            mock.call(
                selected_columns=["project", "count()"],
                query=f"event.type:transaction trace:[{','.join(trace_id_list)}]",
                params={
                    "start": start_time,
                    "end": end_time,
                    "project_id": list(projects_in_org),
                    "organization_id": self.project.organization,
                },
                equations=[],
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
        with Feature({"organizations:filters-and-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?sampleSize={requested_sample_size}&query={query}&statsPeriod=6h"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls

            mock_query.reset_mock()
