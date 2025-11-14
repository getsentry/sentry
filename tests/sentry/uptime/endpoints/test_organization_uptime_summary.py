import uuid
from datetime import datetime, timedelta, timezone
from typing import int, Any

from sentry.testutils.cases import APITestCase, UptimeResultEAPTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.types import IncidentStatus

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
        self.detector = self.create_uptime_detector(uptime_subscription=self.subscription)

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
        check_duration_us=None,
    ):
        """
        Store a single uptime data row. Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement store_uptime_data")

    def test_simple(self) -> None:
        """Test that the endpoint returns correct summary stats using detector IDs."""
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(self.detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            # Verify structure
            assert self.detector.id in data
            stats = data[self.detector.id]

            # Verify expected counts based on test scenarios
            assert stats["totalChecks"] == 8
            assert stats["failedChecks"] == 2  # failures without incident
            assert stats["downtimeChecks"] == 1  # failures with incident
            assert stats["missedWindowChecks"] == 2
            assert "avgDurationUs" in stats

    def test_multiple_detectors(self) -> None:
        """Test endpoint with multiple uptime detectors."""
        # Create second subscription and detector
        subscription_id2 = uuid.uuid4().hex
        subscription2 = self.create_uptime_subscription(
            url="https://example.com", subscription_id=subscription_id2
        )
        detector2 = self.create_uptime_detector(uptime_subscription=subscription2)

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
                uptimeDetectorId=[
                    str(self.detector.id),
                    str(detector2.id),
                ],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            # Verify both detectors are present
            assert self.detector.id in data
            assert detector2.id in data

            # Verify first detector stats
            stats1 = data[self.detector.id]
            assert stats1["totalChecks"] == 8
            assert stats1["failedChecks"] == 2
            assert stats1["downtimeChecks"] == 1
            assert stats1["missedWindowChecks"] == 2

            # Verify second detector stats
            stats2 = data[detector2.id]
            assert stats2["totalChecks"] == 2
            assert stats2["failedChecks"] == 0
            assert stats2["downtimeChecks"] == 1
            assert stats2["missedWindowChecks"] == 0

    def test_empty_results(self) -> None:
        """Test endpoint when no data exists for detector."""
        # Create subscription with no data
        empty_subscription_id = uuid.uuid4().hex
        empty_subscription = self.create_uptime_subscription(
            url="https://empty.com", subscription_id=empty_subscription_id
        )
        empty_detector = self.create_uptime_detector(uptime_subscription=empty_subscription)

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(empty_detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            # Should return empty dict for detectors with no data
            assert data == {}

    def test_invalid_detector_id(self) -> None:
        """Test that an invalid detector ID produces a 400 response."""
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=["999999"],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "Invalid uptime detector ids provided"

    def test_no_detector_id(self) -> None:
        """Test that not sending any detector ID produces a 400 response."""
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "Uptime detector ids must be provided"

    def test_too_many_detector_ids(self) -> None:
        """Test that sending too many detector IDs produces a 400 response."""
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(i) for i in range(101)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "Too many uptime detector ids provided. Maximum is 100"

    def test_cross_project_access_denied(self) -> None:
        """Test that cross-project access is properly restricted."""
        # Create subscription in different project
        other_project = self.create_project(organization=self.organization)
        other_subscription_id = uuid.uuid4().hex
        other_subscription = self.create_uptime_subscription(
            url="https://other.com", subscription_id=other_subscription_id
        )
        other_detector = self.create_uptime_detector(
            uptime_subscription=other_subscription, project=other_project
        )

        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],  # Only include original project
                uptimeDetectorId=[str(other_detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "Invalid uptime detector ids provided"

    def test_success_only_scenario(self) -> None:
        """Test scenario with only successful checks."""
        success_subscription_id = uuid.uuid4().hex
        success_subscription = self.create_uptime_subscription(
            url="https://success.com", subscription_id=success_subscription_id
        )
        success_detector = self.create_uptime_detector(uptime_subscription=success_subscription)

        # Only success checks
        for _ in range(5):
            self.store_uptime_data(success_subscription_id, "success")

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(success_detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            stats = data[success_detector.id]
            assert stats["totalChecks"] == 5
            assert stats["failedChecks"] == 0
            assert stats["downtimeChecks"] == 0
            assert stats["missedWindowChecks"] == 0
            assert "avgDurationUs" in stats

    def test_time_range_filtering(self) -> None:
        """Test that the endpoint accepts time range parameters and filters summary stats."""
        filter_subscription_id = uuid.uuid4().hex
        filter_subscription = self.create_uptime_subscription(
            url="https://filter-test.com", subscription_id=filter_subscription_id
        )
        filter_detector = self.create_uptime_detector(uptime_subscription=filter_subscription)

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
                uptimeDetectorId=[str(filter_detector.id)],
                start=filter_start.isoformat(),
                end=filter_end.isoformat(),
            )
            assert response.data is not None
            data = response.data

            assert filter_detector.id in data
            stats = data[filter_detector.id]
            assert stats["totalChecks"] == 4
            assert stats["failedChecks"] == 0
            assert stats["downtimeChecks"] == 0
            assert stats["missedWindowChecks"] == 0

    def test_no_ids_provided_error(self) -> None:
        """Test that providing no IDs produces an error."""
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.status_code == 400
            assert response.json() == "Uptime detector ids must be provided"


@freeze_time(MOCK_DATETIME)
class OrganizationUptimeSummaryEAPTest(OrganizationUptimeSummaryBaseTest, UptimeResultEAPTestCase):
    __test__ = True

    def store_uptime_data(
        self,
        subscription_id,
        check_status,
        incident_status=IncidentStatus.NO_INCIDENT,
        scheduled_check_time=None,
        check_duration_us=None,
    ):
        kwargs = {
            "subscription_id": uuid.UUID(subscription_id).hex,
            "guid": uuid.UUID(subscription_id).hex,
            "request_url": "https://santry.io",
            "check_status": check_status,
            "incident_status": incident_status,
            "scheduled_check_time": scheduled_check_time,
        }
        if check_duration_us is not None:
            kwargs["check_duration_us"] = check_duration_us

        uptime_result = self.create_eap_uptime_result(**kwargs)
        self.store_uptime_results([uptime_result])

    def test_average_duration_available(self) -> None:
        """Test that average duration is available and correctly calculated for EAP uptime results."""
        duration_subscription_id = uuid.uuid4().hex
        duration_subscription = self.create_uptime_subscription(
            url="https://duration-test.com", subscription_id=duration_subscription_id
        )
        duration_detector = self.create_uptime_detector(uptime_subscription=duration_subscription)

        # Store checks with specific durations
        durations = [100000, 200000, 300000]  # 100ms, 200ms, 300ms in microseconds
        for duration in durations:
            self.store_uptime_data(
                duration_subscription_id,
                "success",
                check_duration_us=duration,
            )

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(duration_detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
            )
            assert response.data is not None
            data = response.data

            stats = data[duration_detector.id]
            assert stats["totalChecks"] == 3
            # Average should be (100000 + 200000 + 300000) / 3 = 200000
            assert stats["avgDurationUs"] == 200000.0
