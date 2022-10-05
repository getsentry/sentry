import datetime
from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone

from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


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
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 2,
            },
            {
                "sdk.version": "7.1.3",
                "sdk.name": "sentry.javascript.react",
                "project": "wind",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 1,
            },
            # project: earth
            {
                "sdk.version": "7.1.5",
                "sdk.name": "sentry.javascript.react",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 7,
                'equation|count_if(transaction.source, notEquals, "") / count()': 1.0,
                'count_if(transaction.source, notEquals, "")': 5,
                "count()": 23,
            },
            # Accounts for less than 10% of total count for this project, and so should be discarded
            {
                "sdk.version": "7.1.6",
                "sdk.name": "sentry.javascript.browser",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 5,
                'equation|count_if(transaction.source, notEquals, "") / count()': 1.0,
                'count_if(transaction.source, notEquals, "")': 3,
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
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 2,
            },
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.javascript.react",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 11,
            },
            {
                "sdk.version": "7.1.3",
                "sdk.name": "sentry.javascript.react",
                "project": "earth",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 9,
            },
            # project: heart
            {
                "sdk.version": "7.1.5",
                "sdk.name": "sentry.javascript.react",
                "project": "heart",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 3,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 3,
            },
            # project: fire
            {
                "sdk.version": "7.1.6",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 5,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 5,
            },
            {
                "sdk.version": "7.1.5",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 5,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 5,
            },
            {
                "sdk.version": "7.1.3",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 6,
            },
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.javascript.react",
                "project": "fire",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 5,
            },
            # project: water
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.javascript.react",
                "project": "water",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
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
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
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
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 1,
            },
            # project: spring
            {
                "sdk.version": "6.5.0-beta.2",
                "sdk.name": "sentry.java.spring",
                "project": "spring",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 6,
                'equation|count_if(transaction.source, notEquals, "") / count()': 1.0,
                'count_if(transaction.source, notEquals, "")': 4,
                "count()": 21,
            },
            # project: timber
            {
                "sdk.version": "6.4.1",
                "sdk.name": "sentry.java.android.timber",
                "project": "timber",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 1.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 7,
                'equation|count_if(transaction.source, notEquals, "") / count()': 1.0,
                'count_if(transaction.source, notEquals, "")': 5,
                "count()": 23,
            },
            # project: dummy
            {
                "sdk.version": "7.1.4",
                "sdk.name": "sentry.unknown",
                "project": "dummy",
                'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                'count_if(trace.client_sample_rate, notEquals, "")': 0,
                'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                'count_if(transaction.source, notEquals, "")': 0,
                "count()": 2,
            },
        ],
    }


@region_silo_test
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
            response = self.client.get(
                f"{self.endpoint}?project={self.project.id}&"
                f"start=2022-08-06T00:02:00+00:00&"
                f"end=2022-08-07T00:00:02+00:00"
            )
            assert response.status_code == 403

    def test_feature_flag_disabled(self):
        self.login_as(self.user)
        response = self.client.get(
            f"{self.endpoint}?project={self.project.id}&"
            f"start=2022-08-06T00:02:00+00:00&"
            f"end=2022-08-07T00:00:02+00:00"
        )
        assert response.status_code == 404

    def test_no_project_ids_filter_requested(self):
        self.login_as(self.user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?"
                f"start=2022-08-06T00:02:00+00:00&"
                f"end=2022-08-07T00:00:02+00:00"
            )
            assert response.status_code == 200
            assert response.data == []

    def test_no_query_start_or_no_query_end(self):
        self.login_as(self.user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?project={self.project.id}&end=2022-08-07T00:00:02+00:00"
            )
            assert response.status_code == 400
            assert response.json()["detail"] == "'start' and 'end' are required"

            response = self.client.get(
                f"{self.endpoint}?project={self.project.id}&start=2022-08-06T00:02:00+00:00"
            )
            assert response.status_code == 400
            assert response.json()["detail"] == "'start' and 'end' are required"

    def test_query_start_is_before_query_end(self):
        self.login_as(self.user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?project="
                f"{self.project.id}&start=2022-08-10T00:02:00+00:00&end=2022-08-07T00:00:02+00:00"
            )
            assert response.status_code == 400
            assert response.json()["detail"] == "'start' has to be before 'end'"

    def test_query_start_and_query_end_are_atmost_one_day_apart(self):
        self.login_as(self.user)
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?project="
                f"{self.project.id}&start=2022-08-05T00:02:00+00:00&end=2022-08-07T00:00:02+00:00"
            )
            assert response.status_code == 400
            assert (
                response.json()["detail"] == "'start' and 'end' have to be a maximum of 1 day apart"
            )

    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_successful_response(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = mocked_discover_query()
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?project={self.project.id}&"
                f"start=2022-08-06T00:02:00+00:00&"
                f"end=2022-08-07T00:00:02+00:00"
            )
            assert response.json() == [
                {
                    "project": "wind",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.4",
                    "isSendingSampleRate": False,
                    "isSendingSource": False,
                    "isSupportedPlatform": True,
                },
                {
                    "project": "earth",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.5",
                    "isSendingSampleRate": True,
                    "isSendingSource": True,
                    "isSupportedPlatform": True,
                },
                {
                    "project": "heart",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.5",
                    "isSendingSampleRate": True,
                    "isSendingSource": False,
                    "isSupportedPlatform": True,
                },
                {
                    "project": "fire",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.6",
                    "isSendingSampleRate": True,
                    "isSendingSource": False,
                    "isSupportedPlatform": True,
                },
                {
                    "project": "water",
                    "latestSDKName": "sentry.javascript.react",
                    "latestSDKVersion": "7.1.4",
                    "isSendingSampleRate": False,
                    "isSendingSource": False,
                    "isSupportedPlatform": True,
                },
                {
                    "project": "spring",
                    "latestSDKName": "sentry.java.spring",
                    "latestSDKVersion": "6.5.0-beta.2",
                    "isSendingSampleRate": True,
                    "isSendingSource": True,
                    "isSupportedPlatform": True,
                },
                {
                    "project": "timber",
                    "latestSDKName": "sentry.java.android.timber",
                    "latestSDKVersion": "6.4.1",
                    "isSendingSampleRate": True,
                    "isSendingSource": True,
                    "isSupportedPlatform": True,
                },
                {
                    "project": "dummy",
                    "latestSDKName": "sentry.unknown",
                    "latestSDKVersion": "7.1.4",
                    "isSendingSampleRate": False,
                    "isSendingSource": False,
                    "isSupportedPlatform": False,
                },
            ]

    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_response_when_no_transactions_are_available(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = {"data": []}
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?project={self.project.id}&"
                f"start=2022-08-06T00:02:00+00:00&"
                f"end=2022-08-07T00:00:02+00:00"
            )
            assert response.json() == []

    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_request_params_are_applied_to_discover_query(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = mocked_discover_query()

        end_time = datetime.datetime(2022, 8, 7, 0, 0, 0, tzinfo=timezone.utc)
        start_time = end_time - timedelta(hours=24)

        calls = [
            mock.call(
                selected_columns=[
                    "sdk.name",
                    "sdk.version",
                    "project",
                    'count_if(trace.client_sample_rate, notEquals, "")',
                    'count_if(transaction.source, notEquals, "")',
                    "count()",
                ],
                query="event.type:transaction",
                params={
                    "start": start_time,
                    "end": end_time,
                    "project_id": [self.project.id],
                    "organization_id": self.project.organization,
                },
                equations=[
                    'count_if(trace.client_sample_rate, notEquals, "") / count()',
                    'count_if(transaction.source, notEquals, "") / count()',
                ],
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
            response = self.client.get(
                f"{self.endpoint}?project={self.project.id}&"
                f"start=2022-08-06T00:02:00+00:00&"
                f"end=2022-08-07T00:00:02+00:00"
            )
            assert response.status_code == 200
            assert mock_query.mock_calls == calls

    @mock.patch("sentry.api.endpoints.organization_dynamic_sampling_sdk_versions.discover.query")
    def test_sdk_versions_incompatible_with_semantic_versions(self, mock_query):
        self.login_as(self.user)
        mock_query.return_value = {
            "data": [
                {
                    "sdk.version": "dev-develop@39fa647",
                    "sdk.name": "sentry.php",
                    "project": "sentry-php",
                    'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                    'count_if(trace.client_sample_rate, notEquals, "")': 0,
                    'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                    'count_if(transaction.source, notEquals, "")': 0,
                    "count()": 2,
                },
                {
                    "sdk.version": "dev-dsc@606d781",
                    "sdk.name": "sentry.php",
                    "project": "sentry-php",
                    'equation|count_if(trace.client_sample_rate, notEquals, "") / count()': 0.0,
                    'count_if(trace.client_sample_rate, notEquals, "")': 0,
                    'equation|count_if(transaction.source, notEquals, "") / count()': 0.0,
                    'count_if(transaction.source, notEquals, "")': 0,
                    "count()": 11,
                },
            ]
        }
        with Feature({"organizations:server-side-sampling": True}):
            response = self.client.get(
                f"{self.endpoint}?project={self.project.id}&"
                f"start=2022-08-06T00:02:00+00:00&"
                f"end=2022-08-07T00:00:02+00:00"
            )
            assert response.json()["detail"] == (
                "Unable to parse sdk versions. Please check that sdk versions are valid semantic versions."
            )
