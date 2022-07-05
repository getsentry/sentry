from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time

from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


def mocked_discover_query():
    return {
        "data": [
            {
                "project": "fire",
                "sdk.name": "javascript",
                "sdk.version": "7.1.6",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                "count()": 4,
                'count_if(trace.client_sample_rate, notEquals, "")': 4,
            },
            {
                "project": "water",
                "sdk.name": "javascript",
                "sdk.version": "7.1.4",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                "count()": 1,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
            },
            {
                "project": "water",
                "sdk.name": "javascript",
                "sdk.version": "7.1.6",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                "count()": 2,
                'count_if(trace.client_sample_rate, notEquals, "")': 2,
            },
            {
                "project": "wind",
                "sdk.name": "javascript",
                "sdk.version": "7.1.5",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                "count()": 2,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
            },
            {
                "project": "wind",
                "sdk.name": "javascript",
                "sdk.version": "7.1.3",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                "count()": 1,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
            },
            {
                "project": "fire",
                "sdk.name": "javascript",
                "sdk.version": "7.1.4",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                "count()": 6,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
            },
            {
                "project": "fire",
                "sdk.name": "javascript",
                "sdk.version": "7.1.5",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                "count()": 3,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
            },
            {
                "project": "fire",
                "sdk.name": "javascript",
                "sdk.version": "7.1.3",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                "count()": 8,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
            },
        ]
    }


class OrganizationDynamicSamplingSDKVersionsTest(APITestCase):
    @property
    def endpoint(self):
        return reverse(
            "sentry-api-0-organization-dynamic-sampling-sdk-versions",
            kwargs={
                "organization_slug": self.organization.slug,
            },
        )

    def test_permission(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(self.endpoint)
            assert response.status_code == 403

    def test_user_permissions_for_project_ids_filter(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?project={self.project.id}")
            assert response.status_code == 403

    def test_feature_flag_disabled(self):
        self.login_as(self.user)
        response = self.client.get(self.endpoint)
        assert response.status_code == 404

    def test_no_project_ids_filter_requested(self):
        self.login_as(self.user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(self.endpoint)
            assert response.status_code == 200
            assert response.data == []

    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_successful_response(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = mocked_discover_query()
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?project={self.project.id}")
            assert response.json() == [
                {
                    "project": "fire",
                    "latestSDKName": "javascript",
                    "lastestSDKVersion": "7.1.6",
                    "isSendingSampleRate": True,
                },
                {
                    "project": "water",
                    "latestSDKName": "javascript",
                    "lastestSDKVersion": "7.1.6",
                    "isSendingSampleRate": True,
                },
                {
                    "project": "wind",
                    "latestSDKName": "javascript",
                    "lastestSDKVersion": "7.1.5",
                    "isSendingSampleRate": False,
                },
            ]

    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_response_when_no_transactions_are_available(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = {"data": []}
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?project={self.project.id}")
            assert response.json() == []

    @freeze_time()
    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_request_params_are_applied_to_discover_query(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = mocked_discover_query()

        end_time = timezone.now()
        start_time = end_time - timedelta(hours=6)

        calls = [
            mock.call(
                selected_columns=[
                    "sdk.name",
                    "sdk.version",
                    "project",
                    'count_if(trace.client_sample_rate, notEquals, "")',
                    "count()",
                ],
                query="event.type:transaction",
                params={
                    "start": start_time,
                    "end": end_time,
                    "project_id": [self.project.id],
                    "organization_id": self.project.organization,
                },
                equations=['count_if(trace.client_sample_rate, notEquals, "") / count()'],
                orderby=[],
                offset=0,
                limit=100,
                auto_fields=True,
                auto_aggregations=True,
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
                transform_alias_to_input_format=True,
                referrer="dynamic-sampling.distribution.fetch-project-sdk-versions-info",
            ),
        ]

        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(f"{self.endpoint}?project={self.project.id}&statsPeriod=6h")
            assert response.status_code == 200
            assert mock_query.mock_calls == calls
