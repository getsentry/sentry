import uuid
from datetime import datetime, timezone

from sentry.testutils.cases import UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from tests.sentry.uptime.endpoints.test_organization_uptime_alert_index import (
    OrganizationUptimeAlertIndexBaseEndpointTest,
)


@region_silo_test
@freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
class ProjectUptimeAlertCheckIndexEndpoint(
    OrganizationUptimeAlertIndexBaseEndpointTest, UptimeCheckSnubaTestCase
):
    endpoint = "sentry-api-0-project-uptime-alert-checks"

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

    @freeze_time(datetime(2025, 1, 21, 19, 4, 18, tzinfo=timezone.utc))
    def test_get(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
        )
        assert response.data is not None
        assert len(response.data) == 6
        first = response.data[0]
        for key in [
            "uptime_subscription_id",
            "uptime_check_id",
            "scheduled_check_time",
            "timestamp",
            "duration_ms",
            "region",
            "check_status",
            "check_status_reason",
            "trace_id",
        ]:
            assert key in first, f"{key} not in {first}"
        assert first["uptime_subscription_id"] == self.project_uptime_subscription.id
