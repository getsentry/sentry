import uuid
from abc import abstractmethod
from datetime import datetime, timedelta

from sentry.testutils.cases import UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import region_silo_test
from sentry.uptime.types import IncidentStatus
from sentry.utils.cursors import Cursor
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest
from tests.sentry.uptime.endpoints.test_base import MOCK_DATETIME, UptimeResultEAPTestCase


class ProjectUptimeAlertCheckIndexBaseTest(UptimeAlertBaseEndpointTest):
    __test__ = False
    endpoint = "sentry-api-0-project-uptime-alert-checks"
    features: dict[str, bool] = {}

    def setUp(self):
        super().setUp()
        self.subscription_id = uuid.uuid4().hex
        self.subscription = self.create_uptime_subscription(
            url="https://santry.io", subscription_id=self.subscription_id
        )
        self.project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription
        )

        test_scenarios: list[dict] = [
            {"check_status": "success", "scheduled_check_time": before_now(minutes=10)},
            {"check_status": "failure", "scheduled_check_time": before_now(minutes=9)},
            {"check_status": "success", "scheduled_check_time": before_now(minutes=8)},
            {
                "check_status": "failure",
                "http_status": None,
                "scheduled_check_time": before_now(minutes=7),
            },
            {"check_status": "success", "scheduled_check_time": before_now(minutes=6)},
            {
                "check_status": "failure",
                "incident_status": IncidentStatus.IN_INCIDENT,
                "scheduled_check_time": before_now(minutes=5),
            },
        ]

        for scenario in test_scenarios:
            kwargs = {
                "incident_status": scenario.get("incident_status", IncidentStatus.NO_INCIDENT),
                "scheduled_check_time": scenario["scheduled_check_time"],
            }
            if "http_status" in scenario:
                kwargs["http_status"] = scenario["http_status"]

            self.store_uptime_data(self.subscription_id, scenario["check_status"], **kwargs)

    @abstractmethod
    def store_uptime_data(
        self,
        subscription_id: str,
        check_status: str,
        incident_status: IncidentStatus = IncidentStatus.NO_INCIDENT,
        scheduled_check_time: datetime | None = None,
        http_status: int | None = None,
    ) -> None:
        """Store a single uptime data row. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement store_uptime_data")

    def test_get(self):
        with self.feature(self.features):
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
                "httpStatusCode",
                "incidentStatus",
            ]:
                assert key in most_recent, f"{key} not in {most_recent}"

            assert most_recent["uptimeCheckId"]
            assert most_recent["uptimeSubscriptionId"] == self.project_uptime_subscription.id
            assert most_recent["regionName"] == "Default Region"
            assert most_recent["checkStatusReason"] == "failure"

            assert any(v for v in response.data if v["checkStatus"] == "failure_incident")
            assert any(v for v in response.data if v["checkStatusReason"] is None)
            assert any(v for v in response.data if v["httpStatusCode"] is None)

    def test_datetime_range(self):
        with self.feature(self.features):
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
        with self.feature(self.features):
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
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.project_uptime_subscription.id,
            )
            assert response.data is not None
            assert len(response.data) == 0

    def test_get_with_none_subscription_id(self):
        with self.feature(self.features):
            # Create a subscription with None subscription_id
            subscription = self.create_uptime_subscription(
                url="https://example.com", subscription_id=None
            )
            project_uptime_subscription = self.create_project_uptime_subscription(
                uptime_subscription=subscription
            )

            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                project_uptime_subscription.id,
            )
            assert response.data == []


@region_silo_test
@freeze_time(MOCK_DATETIME)
class ProjectUptimeAlertCheckIndexEndpoint(
    ProjectUptimeAlertCheckIndexBaseTest, UptimeCheckSnubaTestCase
):
    __test__ = True
    features = {
        "organizations:uptime-eap-enabled": False,
        "organizations:uptime-eap-uptime-results-query": False,
    }

    def store_uptime_data(
        self,
        subscription_id,
        check_status,
        incident_status=IncidentStatus.NO_INCIDENT,
        scheduled_check_time=None,
        http_status=None,
    ):
        # if scheduled_check_time is None:
        #     scheduled_check_time = datetime.now(timezone.utc) - timedelta(hours=12)
        #
        self.store_snuba_uptime_check(
            subscription_id=subscription_id,
            check_status=check_status,
            incident_status=incident_status,
            scheduled_check_time=scheduled_check_time,
            http_status=http_status,
            region="default",
        )


@region_silo_test
@freeze_time(MOCK_DATETIME)
class ProjectUptimeAlertCheckIndexEndpointWithEAPTests(
    ProjectUptimeAlertCheckIndexBaseTest, UptimeResultEAPTestCase
):
    __test__ = True

    def setUp(self):
        self.features = {
            "organizations:uptime-eap-enabled": True,
            "organizations:uptime-eap-uptime-results-query": True,
        }
        super().setUp()

    def store_uptime_data(
        self,
        subscription_id,
        check_status,
        incident_status=IncidentStatus.NO_INCIDENT,
        scheduled_check_time=None,
        http_status=None,
    ):
        create_params = {
            "subscription_id": uuid.UUID(subscription_id).hex,
            "guid": uuid.UUID(subscription_id).hex,
            "check_id": uuid.uuid4().hex,
            "check_status": check_status,
            "incident_status": incident_status,
            "scheduled_check_time": scheduled_check_time,
            "status_reason_type": "failure" if check_status == "failure" else None,
            "region": "default",
            "http_status_code": http_status,
        }
        uptime_result = self.create_eap_uptime_result(**create_params)
        self.store_uptime_results([uptime_result])
