import uuid
from datetime import datetime, timedelta, timezone

from sentry.testutils.cases import APITestCase, UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.uptime.endpoints.organization_uptime_stats import add_extra_buckets_for_epoch_cutoff
from sentry.uptime.models import get_detector
from sentry.uptime.types import IncidentStatus
from sentry.utils import json
from tests.sentry.uptime.endpoints.test_base import UptimeResultEAPTestCase

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
        self.project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription
        )
        self.detector = get_detector(self.subscription)

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

    @override_options(
        {"uptime.date_cutoff_epoch_seconds": (MOCK_DATETIME - timedelta(days=1)).timestamp()}
    )
    def test_simple_with_date_cutoff(self) -> None:
        """Test that the endpoint returns data with date cutoff using detector IDs."""

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(self.detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
            assert response.data is not None
            data = json.loads(json.dumps(response.data))
            assert len(data[str(self.detector.id)]) == 90

    @override_options(
        {"uptime.date_cutoff_epoch_seconds": (MOCK_DATETIME - timedelta(days=1)).timestamp()}
    )
    def test_simple_with_date_cutoff_rounded_resolution(self) -> None:
        """Test that the endpoint returns data with rounded resolution using detector IDs."""

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(self.detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=89, hours=1)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
            assert response.data is not None
            data = json.loads(json.dumps(response.data))
            assert len(data[str(self.detector.id)]) == 89

    @override_options(
        {"uptime.date_cutoff_epoch_seconds": (MOCK_DATETIME - timedelta(days=1)).timestamp()}
    )
    def test_simple_with_date_cutoff_rounded_resolution_past_cutoff(self) -> None:
        """Test that the endpoint returns data for a simple uptime check."""
        subscription_id = uuid.uuid4().hex
        subscription = self.create_uptime_subscription(
            url="https://santry.io/test", subscription_id=subscription_id
        )
        self.create_project_uptime_subscription(uptime_subscription=subscription)

        # Store data for the cutoff test scenario
        self.store_uptime_data(
            subscription_id, "success", scheduled_check_time=(MOCK_DATETIME - timedelta(days=5))
        )
        self.store_uptime_data(
            subscription_id, "failure", scheduled_check_time=MOCK_DATETIME - timedelta(days=5)
        )
        self.store_uptime_data(
            subscription_id, "failure", scheduled_check_time=MOCK_DATETIME - timedelta(hours=2)
        )

        detector = get_detector(subscription)

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                uptimeDetectorId=[str(detector.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=89, hours=1)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
        assert response.data is not None
        data = json.loads(json.dumps(response.data))
        # check that we return all the intervals,
        # but the last one is the failure
        assert len(data[str(detector.id)]) == 89
        assert data[str(detector.id)][-1][1] == {
            "failure": 1,
            "failure_incident": 0,
            "success": 0,
            "missed_window": 0,
        }
        # make sure the rest of the intervals are empty
        for i in range(88):
            assert data[str(detector.id)][i][1] == {
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
class OrganizationUptimeCheckIndexEndpointTest(
    OrganizationUptimeStatsBaseTest, UptimeCheckSnubaTestCase
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


# TODO(jferg): remove after 90 days
def test_add_extra_buckets_for_epoch_cutoff() -> None:
    """Test adding extra buckets when there's an epoch cutoff"""
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, tzinfo=timezone.utc)
    epoch_cutoff = datetime(2025, 1, 1, 12, tzinfo=timezone.utc)
    rollup = 3600  # 1 hour

    # Generate 12 hours of data points starting at epoch cutoff
    data_points = []
    for i in range(12):
        timestamp = int(epoch_cutoff.timestamp()) + (i * 3600)
        data_points.append(
            (timestamp, {"failure": i % 3, "success": (3 - i % 3), "missed_window": 0})
        )

    subscription_id = 1234
    formatted_response = {subscription_id: data_points}

    result = add_extra_buckets_for_epoch_cutoff(
        formatted_response, epoch_cutoff, rollup, start, end
    )

    # Should have 24 buckets total (24 hours worth)
    assert len(result[subscription_id]) == 24

    # First bucket should be at start time
    assert result[subscription_id][0][0] == int(start.timestamp())

    # Last bucket should be the original last bucket
    assert result[subscription_id][-1] == formatted_response[subscription_id][-1]

    # Added buckets should have zero counts
    for bucket in result[subscription_id][:12]:
        assert bucket[1] == {"failure": 0, "failure_incident": 0, "success": 0, "missed_window": 0}

    # Test when epoch cutoff is before start - should return original
    result = add_extra_buckets_for_epoch_cutoff(
        formatted_response, datetime(2024, 1, 1, tzinfo=timezone.utc), rollup, start, end
    )
    assert result == formatted_response

    # Test with no epoch cutoff - should return original
    result = add_extra_buckets_for_epoch_cutoff(formatted_response, None, rollup, start, end)
    assert result == formatted_response


@freeze_time(MOCK_DATETIME)
class OrganizationUptimeStatsEndpointWithEAPTests(
    OrganizationUptimeStatsBaseTest, UptimeResultEAPTestCase
):
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

    def test_detector_ids_with_eap(self) -> None:
        """Test that the endpoint works with uptimeDetectorId parameters for EAP."""
        # Create uptime subscription for EAP tests
        detector_subscription_id = uuid.uuid4().hex
        uptime_subscription = self.create_uptime_subscription(
            url="https://detector-eap-test.com", subscription_id=detector_subscription_id
        )
        self.create_project_uptime_subscription(uptime_subscription=uptime_subscription)
        detector = get_detector(uptime_subscription)

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
