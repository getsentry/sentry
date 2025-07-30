import uuid
from datetime import datetime, timedelta, timezone

from sentry.testutils.cases import APITestCase, UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.uptime.endpoints.organization_uptime_stats import add_missing_buckets
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
        """Test that the endpoint returns data for a simple uptime check."""

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
            assert response.data is not None
            data = json.loads(json.dumps(response.data))
            assert len(data[str(self.project_uptime_subscription.id)]) == 7
            assert data[str(self.project_uptime_subscription.id)][-1][1] == {
                "failure": 4,
                "failure_incident": 1,
                "success": 3,
                "missed_window": 0,
            }
            assert data[str(self.project_uptime_subscription.id)][0][1] == {
                "failure": 0,
                "failure_incident": 0,
                "success": 0,
                "missed_window": 0,
            }

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
                resolution="1d",
            )
            assert response.status_code == 400
            assert response.json() == "Invalid project uptime subscription ids provided"

    def test_no_uptime_subscription_id(self) -> None:
        """
        Test that not sending any uptime_subscription_id produces a 400
        response.
        """
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[],
                since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1d",
            )
            assert response.status_code == 400
            assert response.json() == "No project uptime subscription ids provided"

    def test_too_many_periods(self) -> None:
        """
        Test that requesting a high resolution across a large period of time
        produces a 400 response.
        """
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
                since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1m",
            )
            assert response.status_code == 400
            assert response.json() == "error making request"

    def test_too_many_uptime_subscription_ids(self) -> None:
        """
        Test that sending a large number of subscription IDs produces a 400
        """

        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                projectUptimeSubscriptionId=[str(uuid.uuid4()) for _ in range(101)],
                since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
                until=datetime.now(timezone.utc).timestamp(),
                resolution="1h",
            )
            assert response.status_code == 400
            assert (
                response.json()
                == "Too many project uptime subscription ids provided. Maximum is 100"
            )


def test_add_missing_buckets() -> None:
    """Test adding missing buckets to ensure full time range coverage"""
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, tzinfo=timezone.utc)
    rollup = 3600  # 1 hour

    # Generate 12 hours of data points starting at 12:00 (missing first 12 hours)
    data_points = []
    start_data_time = datetime(2025, 1, 1, 12, tzinfo=timezone.utc)
    for i in range(12):
        timestamp = int(start_data_time.timestamp()) + (i * 3600)
        data_points.append(
            (timestamp, {"failure": i % 3, "success": (3 - i % 3), "missed_window": 0})
        )

    subscription_id = 1234
    formatted_response = {subscription_id: data_points}

    result = add_missing_buckets(formatted_response, rollup, start, end)

    # Should have 24 buckets total (24 hours worth)
    assert len(result[subscription_id]) == 24

    # First bucket should be at start time
    assert result[subscription_id][0][0] == int(start.timestamp())

    # Last bucket should be the original last bucket
    assert result[subscription_id][-1] == formatted_response[subscription_id][-1]

    # Added buckets should have zero counts
    for bucket in result[subscription_id][:12]:
        assert bucket[1] == {"failure": 0, "failure_incident": 0, "success": 0, "missed_window": 0}

    # Test when response already has full coverage - should return original
    full_data_points = []
    for i in range(24):
        timestamp = int(start.timestamp()) + (i * 3600)
        full_data_points.append((timestamp, {"failure": 0, "success": 1, "missed_window": 0}))

    full_response = {subscription_id: full_data_points}
    result = add_missing_buckets(full_response, rollup, start, end)
    assert result == full_response

    # Test with empty response - should return original
    result = add_missing_buckets({}, rollup, start, end)
    assert result == {}


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
