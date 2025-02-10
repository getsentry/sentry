import uuid
from datetime import datetime, timedelta, timezone

from sentry.testutils.cases import UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import region_silo_test
from sentry.utils.cursors import Cursor
from tests.sentry.uptime.endpoints.test_organization_uptime_alert_index import (
    OrganizationUptimeAlertIndexBaseEndpointTest,
)

MOCK_DATETIME = datetime.now(tz=timezone.utc) - timedelta(days=1)


@region_silo_test
@freeze_time(MOCK_DATETIME)
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
            "uptimeSubscriptionId",
            "uptimeCheckId",
            "scheduledCheckTime",
            "timestamp",
            "durationMs",
            "region",
            "checkStatus",
            "checkStatusReason",
            "traceId",
            "httpStatusCode",
        ]:
            assert key in first, f"{key} not in {first}"
        assert first["uptimeSubscriptionId"] == self.project_uptime_subscription.id

    def test_datetime_range(self):
        # all of our checks are stored in the last 5 minutes, so query for 10 days ago and expect 0 results
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
            qs_params={
                "start": datetime.now() - timedelta(days=10),
                "end": datetime.now() - timedelta(days=9),
            },
        )
        assert len(response.data) == 0
        # query for the last 3 days and expect 6 results
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
            qs_params={
                "start": datetime.now() - timedelta(days=3),
                "end": datetime.now(),
            },
        )
        assert len(response.data) == 6

    # TODO: fix this test once snuba is fixed
    def test_get_paginated(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
            qs_params={"cursor": Cursor(0, 0), "per_page": 2},
        )
        assert response.data is not None
        assert len(response.data) == 2

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
            qs_params={"cursor": Cursor(0, 2), "per_page": 2},
        )
        assert response.data is not None
        assert len(response.data) == 2

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
            qs_params={"cursor": Cursor(0, 4), "per_page": 2},
        )
        assert response.data is not None
        assert len(response.data) == 2

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
            qs_params={"cursor": Cursor(0, 20), "per_page": 2},
        )
        assert response.data is not None
        assert len(response.data) == 0

    @override_options(
        {"uptime.date_cutoff_epoch_seconds": (MOCK_DATETIME - timedelta(seconds=1)).timestamp()}
    )
    def test_get_with_date_cutoff(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
        )
        assert response.data is not None
        assert len(response.data) == 0
