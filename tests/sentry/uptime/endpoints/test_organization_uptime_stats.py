import uuid
from datetime import datetime, timedelta, timezone

from sentry.testutils.cases import APITestCase, UptimeResultEAPTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.types import IncidentStatus
from sentry.utils import json

MOCK_DATETIME = datetime.now(tz=timezone.utc) - timedelta(days=1)


class OrganizationUptimeStatsBaseTest(APITestCase):
    __test__ = False
    endpoint = "sentry-api-0-organization-uptime-stats"
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
            {"check_status": "failure"},
            {"check_status": "success"},
            {"check_status": "failure"},
            {"check_status": "success"},
            {"check_status": "failure"},
            {"check_status": "failure"},
            {"check_status": "failure", "incident_status": IncidentStatus.IN_INCIDENT},
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
        """Store a single uptime data row. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement store_uptime_data")

    def test_simple(self) -> None:
        """Test that the endpoint returns data for a simple uptime check using detector IDs."""

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(self.detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
            assert response.data is not None
            data = json.loads(json.dumps(response.data))
            assert len(data[str(self.detector.id)]) == 7
            assert data[str(self.detector.id)][-1][1] == {
                "failure": 4,
                "failure_incident": 1,
                "success": 3,
                "missed_window": 0,
            }
            assert data[str(self.detector.id)][0][1] == {
                "failure": 0,
                "failure_incident": 0,
                "success": 0,
                "missed_window": 0,
            }

    def test_invalid_detector_id(self) -> None:
        """
        Test that an invalid detector ID produces a 400 response.
        """
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=["999999"],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
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
                resolution="1d",
            )
            assert response.status_code == 400
            assert response.json() == "Uptime detector ids must be provided"

    def test_too_many_periods(self) -> None:
        """Test that requesting a high resolution across a large period of time produces a 400 response."""
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(self.detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1m",
            )
            assert response.status_code == 400
            assert response.json() == "error making request"

    def test_too_many_detector_ids_limit(self) -> None:
        """Test that sending a large number of detector IDs produces a 400."""
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(i) for i in range(101)],
                since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1h",
            )
            assert response.status_code == 400
            assert response.json() == "Too many uptime detector ids provided. Maximum is 100"

    def test_no_ids_provided_error(self) -> None:
        """Test that providing no IDs produces an error."""
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
            assert response.status_code == 400
            assert response.json() == "Uptime detector ids must be provided"


@freeze_time(MOCK_DATETIME)
class OrganizationUptimeStatsEndpointWithEAPTests(
    OrganizationUptimeStatsBaseTest, UptimeResultEAPTestCase
):
    __test__ = True

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

    def test_detector_ids_with_eap(self) -> None:
        """Test that the endpoint works with uptimeDetectorId parameters for EAP."""
        # Create uptime subscription for EAP tests
        detector_subscription_id = uuid.uuid4().hex
        uptime_subscription = self.create_uptime_subscription(
            url="https://detector-eap-test.com", subscription_id=detector_subscription_id
        )
        detector = self.create_uptime_detector(uptime_subscription=uptime_subscription)

        # Add some test data
        for scenario in (
            {"check_status": "success"},
            {"check_status": "failure"},
            {"check_status": "failure", "incident_status": IncidentStatus.IN_INCIDENT},
        ):
            uptime_result = self.create_eap_uptime_result(
                subscription_id=uuid.UUID(detector_subscription_id).hex,
                guid=uuid.UUID(detector_subscription_id).hex,
                request_url="https://detector-eap-test.com",
                **scenario,
            )
            self.store_uptime_results([uptime_result])

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
            assert response.data is not None
            data = json.loads(json.dumps(response.data))
            assert len(data[str(detector.id)]) == 7
            # Should have the data we added
            assert data[str(detector.id)][-1][1] == {
                "failure": 1,
                "failure_incident": 1,
                "success": 1,
                "missed_window": 0,
            }
