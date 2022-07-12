import datetime
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
            # project: wind
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.javascript.react",
                "project": "wind",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 2,
            },
            {
                "sdk.version": "7.1.3",
                "sdk.name": "sentry.javascript.react",
                "project": "wind",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 1,
            },
            # project: earth
            {
                "sdk.version": "7.1.5",
                "sdk.name": "sentry.javascript.react",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 7,
                "count()": 23,
            },
            # Accounts for less than 10% of total count for this project, and so should be discarded
            {
                "sdk.version": "7.1.6",
                "sdk.name": "sentry.javascript.browser",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 5,
                "count()": 4,
            },
            # Accounts for less than 5% of total count for this project and sdk.name so should be
            # discarded
            {
                "sdk.version": "7.1.6",
                "sdk.name": "sentry.javascript.react",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 5,
                "count()": 2,
            },
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.javascript.react",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 11,
            },
            {
                "sdk.version": "7.1.3",
                "sdk.name": "sentry.javascript.react",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 9,
            },
            # project: heart
            {
                "sdk.version": "7.1.5",
                "sdk.name": "sentry.javascript.react",
                "project": "heart",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 3,
                "count()": 3,
            },
            # project: fire
            {
                "sdk.version": "7.1.6",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 5,
                "count()": 5,
            },
            {
                "sdk.version": "7.1.5",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 5,
                "count()": 5,
            },
            {
                "sdk.version": "7.1.3",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 6,
            },
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 5,
            },
            # project: water
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.javascript.react",
                "project": "water",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 100,
            },
            # Accounts for less than 5% of total count for this project and sdk.name so should be
            # discarded
            {
                "sdk.version": "7.1.3",
                "sdk.name": "sentry.javascript.react",
                "project": "water",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                "count()": 1,
            },
            # Accounts for less than 5% of total count for this project and sdk.name so should be
            # discarded
            {
                "sdk.version": "7.1.6",
                "sdk.name": "sentry.javascript.react",
                "project": "water",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 1,
                "count()": 1,
            },
        ],
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
                    "project": "wind",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.4",
                    "isSendingSampleRate": False,
                },
                {
                    "project": "earth",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.5",
                    "isSendingSampleRate": True,
                },
                {
                    "project": "heart",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.5",
                    "isSendingSampleRate": True,
                },
                {
                    "project": "fire",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.6",
                    "isSendingSampleRate": True,
                },
                {
                    "project": "water",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.4",
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

    @freeze_time("2022-07-07 03:21:34")
    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_request_params_are_applied_to_discover_query(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = mocked_discover_query()

        end_time = datetime.datetime(2022, 7, 7, 3, 20, 0, tzinfo=timezone.utc)
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
