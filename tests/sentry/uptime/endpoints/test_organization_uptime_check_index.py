import random
import uuid
from datetime import datetime, timedelta, timezone

from sentry.testutils.cases import UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json
from tests.sentry.uptime.endpoints.test_organization_uptime_alert_index import (
    OrganizationUptimeAlertIndexBaseEndpointTest,
)


@freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
class OrganizationUptimeCheckIndexEndpointTest(
    OrganizationUptimeAlertIndexBaseEndpointTest, UptimeCheckSnubaTestCase
):
    endpoint = "sentry-api-0-organization-uptime-stats"

    def store_snuba_uptime_check(self, subscription_id: str | None, check_status: str):
        scheduled_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        timestamp = scheduled_time + timedelta(seconds=1)
        http_status = 200 if check_status == "success" else random.choice([408, 500, 502, 503, 504])

        self.store_uptime_check(
            {
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "retention_days": 30,
                "region": f"region_{random.randint(1, 3)}",
                "environment": "production",
                "subscription_id": subscription_id,
                "guid": str(uuid.uuid4()),
                "scheduled_check_time_ms": int(scheduled_time.timestamp() * 1000),
                "actual_check_time_ms": int(timestamp.timestamp() * 1000),
                "duration_ms": random.randint(1, 1000),
                "status": check_status,
                "status_reason": None,
                "trace_id": str(uuid.uuid4()),
                "request_info": {
                    "status_code": http_status,
                },
            }
        )

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.subscription_id = str(uuid.uuid4())
        self.subscription = self.create_uptime_subscription(
            url="https://santry.io", subscription_id=self.subscription_id
        )
        self.create_project_uptime_subscription(uptime_subscription=self.subscription)

        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="failure")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="failure")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="failure")

    def test_simple(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            uptime_subscription_id=[self.subscription_id],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.data is not None
        data = json.loads(json.dumps(response.data))
        assert data == {
            self.subscription_id: [
                [1736881458, {"failure": 0.0, "success": 0.0}],
                [1736967858, {"failure": 0.0, "success": 0.0}],
                [1737054258, {"failure": 0.0, "success": 0.0}],
                [1737140658, {"failure": 0.0, "success": 0.0}],
                [1737227058, {"failure": 0.0, "success": 0.0}],
                [1737313458, {"failure": 0.0, "success": 0.0}],
                [1737399858, {"failure": 3.0, "success": 3.0}],
            ]
        }

    @freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
    def test_invalid_uptime_subscription_id(self):
        """Test that the endpoint returns data for a simple uptime check."""
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            uptime_subscription_id=[str(uuid.uuid4())],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.status_code == 400

    @freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
    def test_no_uptime_subscription_id(self):
        """Test that the endpoint returns data for a simple uptime check."""
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            uptime_subscription_id=[],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.status_code == 400

    @freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
    def test_too_many_periods(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            uptime_subscription_id=[self.subscription_id],
            since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1h",
        )
        assert response.status_code == 400

    @freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
    def test_too_many_uptime_subscription_ids(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            uptime_subscription_id=[str(uuid.uuid4()) for _ in range(101)],
            since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1h",
        )
        assert response.status_code == 400
