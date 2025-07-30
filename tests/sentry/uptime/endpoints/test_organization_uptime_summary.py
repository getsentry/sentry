import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sentry.testutils.cases import APITestCase, UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.types import IncidentStatus
from tests.sentry.uptime.endpoints.test_base import UptimeResultEAPTestCase

MOCK_DATETIME = datetime.now(tz=timezone.utc) - timedelta(days=1)


class OrganizationUptimeSummaryBaseTest(APITestCase):
    __test__ = False
    endpoint = "sentry-api-0-organization-uptime-summary"
    features: dict[str, bool] = {}

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.subscription_id = uuid.uuid4().hex
        self.subscription = self.create_uptime_subscription(
            url="https://santry.io", subscription_id=self.subscription_id
        )
        self.project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription
        )

        scenarios: list[dict] = [
            {"check_status": "success"},
            {"check_status": "success"},
            {"check_status": "success"},
            {"check_status": "failure", "incident_status": IncidentStatus.NO_INCIDENT},
            {"check_status": "failure", "incident_status": IncidentStatus.NO_INCIDENT},
            {"check_status": "failure", "incident_status": IncidentStatus.IN_INCIDENT},
            {"check_status": "missed_window"},
            {"check_status": "missed_window"},
        ]

        for scenario in scenarios:
            self.store_uptime_data(self.subscription_id, **scenario)

    def store_uptime_data(
        self,
        subscription_id,
        check_status,
        incident_status=IncidentStatus.NO_INCIDENT,
        scheduled_check_time=None,
    ):
        """
        Store a single uptime data row. Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement store_uptime_data")

    def test_simple(self) -> None:
        """
        Test that the endpoint returns correct summary stats.
        """
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            # Verify structure
            assert self.project_uptime_subscription.id in data
            stats = data[self.project_uptime_subscription.id]

            # Verify expected counts based on test scenarios
            assert stats["totalChecks"] == 8
            assert stats["failedChecks"] == 2  # failures without incident
            assert stats["downtimeChecks"] == 1  # failures with incident
            assert stats["missedWindowChecks"] == 2

    def test_multiple_subscriptions(self) -> None:
        """
        Test endpoint with multiple uptime subscriptions.
        """
        # Create second subscription
        subscription_id2 = uuid.uuid4().hex
        subscription2 = self.create_uptime_subscription(
            url="https://example.com", subscription_id=subscription_id2
        )
        project_uptime_subscription2 = self.create_project_uptime_subscription(
            uptime_subscription=subscription2
        )

        # Add data for second subscription
        scenarios2: list[dict[str, Any]] = [
            {"check_status": "success"},
            {"check_status": "failure", "incident_status": IncidentStatus.IN_INCIDENT},
        ]
        for scenario in scenarios2:
            self.store_uptime_data(subscription_id2, **scenario)

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[
                    str(self.project_uptime_subscription.id),
                    str(project_uptime_subscription2.id),
                ],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            # Verify both subscriptions are present
            assert self.project_uptime_subscription.id in data
            assert project_uptime_subscription2.id in data

            # Verify first subscription stats
            stats1 = data[self.project_uptime_subscription.id]
            assert stats1["totalChecks"] == 8
            assert stats1["failedChecks"] == 2
            assert stats1["downtimeChecks"] == 1
            assert stats1["missedWindowChecks"] == 2

            # Verify second subscription stats
            stats2 = data[project_uptime_subscription2.id]
            assert stats2["totalChecks"] == 2
            assert stats2["failedChecks"] == 0
            assert stats2["downtimeChecks"] == 1
            assert stats2["missedWindowChecks"] == 0

    def test_empty_results(self) -> None:
        """
        Test endpoint when no data exists for subscription
        ."""
        # Create subscription with no data
        empty_subscription_id = uuid.uuid4().hex
        empty_subscription = self.create_uptime_subscription(
            url="https://empty.com", subscription_id=empty_subscription_id
        )
        empty_project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=empty_subscription
        )

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(empty_project_uptime_subscription.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            # Should return empty dict for subscriptions with no data
            assert data == {}

    def test_invalid_uptime_subscription_id(self) -> None:
        """
        Test that an invalid uptime_subscription_id produces a 400 response.
        """
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(uuid.uuid4())],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "Invalid project uptime subscription ids provided"

    def test_no_uptime_subscription_id(self) -> None:
        """
        Test that not sending any uptime_subscription_id produces a 400 response.
        """
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "No project uptime subscription ids provided"

    def test_too_many_uptime_subscription_ids(self) -> None:
        """
        Test that sending too many subscription IDs produces a 400 response.
        """
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(uuid.uuid4()) for _ in range(101)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert (
                response.json()
                == "Too many project uptime subscription ids provided. Maximum is 100"
            )

    def test_cross_project_access_denied(self) -> None:
        """
        Test that cross-project access is properly restricted.
        """
        # Create subscription in different project
        other_project = self.create_project(organization=self.organization)
        other_subscription_id = uuid.uuid4().hex
        other_subscription = self.create_uptime_subscription(
            url="https://other.com", subscription_id=other_subscription_id
        )
        other_project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=other_subscription, project=other_project
        )

        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],  # Only include original project
                projectUptimeSubscriptionId=[str(other_project_uptime_subscription.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "Invalid project uptime subscription ids provided"

    def test_success_only_scenario(self) -> None:
        """
        Test scenario with only successful checks.
        """
        success_subscription_id = uuid.uuid4().hex
        success_subscription = self.create_uptime_subscription(
            url="https://success.com", subscription_id=success_subscription_id
        )
        success_project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=success_subscription
        )

        # Only success checks
        for _ in range(5):
            self.store_uptime_data(success_subscription_id, "success")

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(success_project_uptime_subscription.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            stats = data[success_project_uptime_subscription.id]
            assert stats["totalChecks"] == 5
            assert stats["failedChecks"] == 0
            assert stats["downtimeChecks"] == 0
            assert stats["missedWindowChecks"] == 0

    def test_time_range_filtering(self) -> None:
        """
        Test that the endpoint accepts time range parameters and filters summary stats.
        """
        filter_subscription_id = uuid.uuid4().hex
        filter_subscription = self.create_uptime_subscription(
            url="https://filter-test.com", subscription_id=filter_subscription_id
        )
        filter_project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=filter_subscription
        )

        for i in range(10):
            check_time = datetime.now(timezone.utc) - timedelta(minutes=i * 5)
            self.store_uptime_data(
                filter_subscription_id,
                "success",
                scheduled_check_time=check_time,
            )

        # Test that endpoint processes time range parameters without errors
        filter_start = datetime.now(timezone.utc) - timedelta(minutes=20)
        filter_end = datetime.now(timezone.utc)

        with self.feature(self.features):
            # Query with time range - should work without error
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(filter_project_uptime_subscription.id)],
                start=filter_start.isoformat(),
                end=filter_end.isoformat(),
            )
            assert response.data is not None
            data = response.data

            assert filter_project_uptime_subscription.id in data
            stats = data[filter_project_uptime_subscription.id]
            assert stats["totalChecks"] == 4
            assert stats["failedChecks"] == 0
            assert stats["downtimeChecks"] == 0
            assert stats["missedWindowChecks"] == 0


@freeze_time(MOCK_DATETIME)
class OrganizationUptimeSummarySnubaTest(
    OrganizationUptimeSummaryBaseTest, UptimeCheckSnubaTestCase
):
    __test__ = True

    def store_uptime_data(
        self,
        subscription_id,
        check_status,
        incident_status=IncidentStatus.NO_INCIDENT,
        scheduled_check_time=None,
    ):
        self.store_snuba_uptime_check(
            subscription_id=subscription_id,
            check_status=check_status,
            incident_status=incident_status,
            scheduled_check_time=scheduled_check_time,
        )


@freeze_time(MOCK_DATETIME)
class OrganizationUptimeSummaryEAPTest(OrganizationUptimeSummaryBaseTest, UptimeResultEAPTestCase):
    __test__ = True

    def setUp(self) -> None:
        super().setUp()
        self.features = {
            "organizations:uptime-eap-enabled": True,
            "organizations:uptime-eap-uptime-results-query": True,
        }

    def store_uptime_data(
        self,
        subscription_id,
        check_status,
        incident_status=IncidentStatus.NO_INCIDENT,
        scheduled_check_time=None,
    ):
        uptime_result = self.create_eap_uptime_result(
            subscription_id=uuid.UUID(subscription_id).hex,
            guid=uuid.UUID(subscription_id).hex,
            request_url="https://santry.io",
            check_status=check_status,
            incident_status=incident_status,
            scheduled_check_time=scheduled_check_time,
        )
        self.store_uptime_results([uptime_result])
