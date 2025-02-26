import uuid
from datetime import datetime, timedelta, timezone

from sentry.testutils.cases import SpanTestCase, UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import region_silo_test
from sentry.uptime.types import IncidentStatus
from sentry.utils.cursors import Cursor
from tests.sentry.uptime.endpoints.test_organization_uptime_alert_index import (
    OrganizationUptimeAlertIndexBaseEndpointTest,
)

MOCK_DATETIME = datetime.now(tz=timezone.utc) - timedelta(days=1)


@region_silo_test
@freeze_time(MOCK_DATETIME)
class ProjectUptimeAlertCheckIndexEndpoint(
    OrganizationUptimeAlertIndexBaseEndpointTest, UptimeCheckSnubaTestCase, SpanTestCase
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

        trace_id = uuid.uuid4()
        self.store_spans(
            spans=[self.create_span(trace_id=trace_id), self.create_span(trace_id=trace_id)],
            is_eap=True,
        )

        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="failure")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(
            subscription_id=self.subscription_id,
            check_status="failure",
            http_status=None,
        )
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(
            subscription_id=self.subscription_id,
            check_status="failure",
            incident_status=IncidentStatus.IN_INCIDENT,
            trace_id=trace_id,
        )

    def test_get(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.project_uptime_subscription.id,
        )
        assert response.data is not None
        assert len(response.data) == 6
        most_recent = response.data[0]
        for key in [
            "uptimeSubscriptionId",
            "uptimeCheckId",
            "scheduledCheckTime",
            "timestamp",
            "durationMs",
            "region",
            "regionName",
            "checkStatus",
            "checkStatusReason",
            "traceId",
            "traceSpansCount",
            "httpStatusCode",
            "incidentStatus",
        ]:
            assert key in most_recent, f"{key} not in {most_recent}"

        assert most_recent["uptimeCheckId"]
        assert most_recent["uptimeSubscriptionId"] == self.project_uptime_subscription.id
        assert most_recent["regionName"] == "Default Region"
        assert most_recent["checkStatusReason"] == "failure"
        assert most_recent["traceSpansCount"] == 2

        assert any(v for v in response.data if v["checkStatus"] == "failure_incident")
        assert any(v for v in response.data if v["checkStatusReason"] is None)
        assert any(v for v in response.data if v["httpStatusCode"] is None)

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
