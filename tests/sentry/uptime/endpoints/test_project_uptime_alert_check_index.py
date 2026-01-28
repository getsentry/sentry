import uuid
from abc import abstractmethod
from datetime import datetime, timedelta, timezone

from sentry.testutils.cases import UptimeResultEAPTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.uptime.types import IncidentStatus
from sentry.utils.cursors import Cursor
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest

MOCK_DATETIME = datetime.now(tz=timezone.utc) - timedelta(days=1)

MOCK_ASSERTION_FAILURE_DATA = {
    "root": {
        "op": "and",
        "children": [
            {
                "op": "not",
                "operand": {"op": "json_path", "value": '$.components[?@.status == "operational"]'},
            },
        ],
    }
}


class ProjectUptimeAlertCheckIndexBaseTest(UptimeAlertBaseEndpointTest):
    __test__ = False
    endpoint = "sentry-api-0-project-uptime-alert-checks"
    features: dict[str, bool] = {}

    def setUp(self) -> None:
        super().setUp()
        self.subscription_id = uuid.uuid4().hex
        self.subscription = self.create_uptime_subscription(
            url="https://santry.io", subscription_id=self.subscription_id
        )
        self.detector = self.create_uptime_detector(uptime_subscription=self.subscription)

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

    def test_get(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
            )
            assert response.data is not None
            assert len(response.data) == 6
            most_recent = response.data[0]
            for key in [
                "uptimeCheckId",
                "scheduledCheckTime",
                "timestamp",
                "durationMs",
                "region",
                "regionName",
                "checkStatus",
                "checkStatusReason",
                "assertionFailureData",
                "traceId",
                "httpStatusCode",
                "incidentStatus",
            ]:
                assert key in most_recent, f"{key} not in {most_recent}"

            assert most_recent["uptimeCheckId"]
            assert most_recent["regionName"] == "Default Region"
            assert most_recent["checkStatusReason"] == "failure"
            assert most_recent["assertionFailureData"] == MOCK_ASSERTION_FAILURE_DATA

            assert any(v for v in response.data if v["checkStatus"] == "failure_incident")
            assert any(v for v in response.data if v["checkStatusReason"] is None)
            assert any(v for v in response.data if v["httpStatusCode"] is None)

    def test_datetime_range(self) -> None:
        with self.feature(self.features):
            # all of our checks are stored in the last 5 minutes, so query for 10 days ago and expect 0 results
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
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
                self.detector.id,
                qs_params={
                    "start": datetime.now() - timedelta(days=3),
                    "end": datetime.now(),
                },
            )
            assert len(response.data) == 6

    # TODO: fix this test once snuba is fixed
    def test_get_paginated(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
                qs_params={"cursor": Cursor(0, 0), "per_page": 2},
            )
            assert response.data is not None
            assert len(response.data) == 2

            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
                qs_params={"cursor": Cursor(0, 2), "per_page": 2},
            )
            assert response.data is not None
            assert len(response.data) == 2

            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
                qs_params={"cursor": Cursor(0, 4), "per_page": 2},
            )
            assert response.data is not None
            assert len(response.data) == 2

            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
                qs_params={"cursor": Cursor(0, 20), "per_page": 2},
            )
            assert response.data is not None
            assert len(response.data) == 0

    def test_get_with_none_subscription_id(self) -> None:
        with self.feature(self.features):
            # Create a subscription with None subscription_id
            subscription = self.create_uptime_subscription(
                url="https://example.com", subscription_id=None
            )
            detector = self.create_uptime_detector(uptime_subscription=subscription)

            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                detector.id,
            )
            assert response.data == []


@region_silo_test
@freeze_time(MOCK_DATETIME)
class ProjectUptimeAlertCheckIndexEndpointWithEAPTests(
    ProjectUptimeAlertCheckIndexBaseTest, UptimeResultEAPTestCase
):
    __test__ = True

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
            "assertion_failure_data": (
                MOCK_ASSERTION_FAILURE_DATA if check_status == "failure" else None
            ),
        }
        uptime_result = self.create_eap_uptime_result(**create_params)
        self.store_uptime_results([uptime_result])
