from dataclasses import dataclass
from unittest.mock import patch

from sentry.incidents.grouptype import MetricAlertFire
from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    GroupTypeRegistry,
    MonitorIncidentType,
    PerformanceSlowDBQueryGroupType,
    UptimeDomainCheckFailure,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.handlers.detector import DetectorEvaluationResult, DetectorHandler
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel


class OrganizationDataConditionAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-detector-type-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.registry_patcher = patch(
            "sentry.workflow_engine.endpoints.organization_detector_types.grouptype.registry",
            new=GroupTypeRegistry(),
        )
        self.registry_patcher.start()

        class MockDetectorHandler(DetectorHandler[dict]):
            def evaluate(
                self, data_packet: DataPacket[dict]
            ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
                return {None: DetectorEvaluationResult(None, True, DetectorPriorityLevel.HIGH)}

        @dataclass(frozen=True)
        class TestMetricGroupType(GroupType):
            type_id = 1
            slug = MetricAlertFire.slug
            description = "Metric alert"
            category = GroupCategory.METRIC_ALERT.value
            detector_handler = MockDetectorHandler
            released = True

        @dataclass(frozen=True)
        class TestCronsGroupType(GroupType):
            type_id = 2
            slug = MonitorIncidentType.slug
            description = "Crons"
            category = GroupCategory.CRON.value
            detector_handler = MockDetectorHandler
            released = True

        @dataclass(frozen=True)
        class TestUptimeGroupType(GroupType):
            type_id = 3
            slug = UptimeDomainCheckFailure.slug
            description = "Uptime"
            category = GroupCategory.UPTIME.value
            detector_handler = MockDetectorHandler
            released = True

        # Should not be included in the response
        @dataclass(frozen=True)
        class TestPerformanceGroupType(GroupType):
            type_id = 4
            slug = PerformanceSlowDBQueryGroupType.slug
            description = "Performance"
            category = GroupCategory.PERFORMANCE.value
            released = True

    def tearDown(self):
        super().tearDown()
        self.registry_patcher.stop()


@region_silo_test
class OrganizationDataConditionIndexBaseTest(OrganizationDataConditionAPITestCase):
    def test_simple(self):
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert len(response.data) == 3
        assert response.data == [
            MetricAlertFire.slug,
            MonitorIncidentType.slug,
            UptimeDomainCheckFailure.slug,
        ]
