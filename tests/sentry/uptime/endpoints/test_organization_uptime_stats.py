import uuid
from datetime import datetime, timedelta, timezone
from unittest import skip

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

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.subscription_id = uuid.uuid4().hex
        self.subscription = self.create_uptime_subscription(
            url="https://santry.io", subscription_id=self.subscription_id
        )
        self.project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription
        )

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
            projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.data is not None
        data = json.loads(json.dumps(response.data))
        assert data == {
            str(self.project_uptime_subscription.id): [
                [1736881458, {"failure": 0, "success": 0, "missed_window": 0}],
                [1736967858, {"failure": 0, "success": 0, "missed_window": 0}],
                [1737054258, {"failure": 0, "success": 0, "missed_window": 0}],
                [1737140658, {"failure": 0, "success": 0, "missed_window": 0}],
                [1737227058, {"failure": 0, "success": 0, "missed_window": 0}],
                [1737313458, {"failure": 0, "success": 0, "missed_window": 0}],
                [1737399858, {"failure": 3, "success": 3, "missed_window": 0}],
            ]
        }

    @freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
    def test_invalid_uptime_subscription_id(self):
        """Test that the endpoint returns data for a simple uptime check."""
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(uuid.uuid4())],
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
            projectUptimeSubscriptionId=[],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.status_code == 400

    @freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
    @skip("vgrozdanic: This test is flaky and should be skipped")
    def test_too_many_periods(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
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
            projectUptimeSubscriptionId=[str(uuid.uuid4()) for _ in range(101)],
            since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1h",
        )
        assert response.status_code == 400
