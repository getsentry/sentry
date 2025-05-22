from dataclasses import dataclass
from unittest.mock import patch

from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    GroupTypeRegistry,
    MonitorIncidentType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.workflow_engine.handlers.detector import DetectorHandler, DetectorOccurrence
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
)


@region_silo_test
class OrganizationDetectorTypesAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-detector-type-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.registry_patcher = patch(
            "sentry.workflow_engine.endpoints.organization_detector_types.grouptype.registry",
            new=GroupTypeRegistry(),
        )
        self.registry_patcher.start()

        class MockDetectorHandler(DetectorHandler[dict, bool]):
            def evaluate(
                self, data_packet: DataPacket[dict]
            ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
                return {None: DetectorEvaluationResult(None, True, DetectorPriorityLevel.HIGH)}

            def extract_value(self, data_packet: DataPacket[dict]) -> bool:
                return True

            def extract_dedupe_value(self, data_packet: DataPacket[dict]) -> int:
                return 1

            def create_occurrence(
                self,
                evaluation_result: ProcessedDataConditionGroup,
                data_packet: DataPacket[dict],
                priority: DetectorPriorityLevel,
            ) -> tuple[DetectorOccurrence, EventData]:
                return (
                    DetectorOccurrence(
                        issue_title="Test",
                        subtitle="Test",
                        resource_id=None,
                        evidence_data={},
                        evidence_display=[],
                        type=TestMetricGroupType,
                        level="",
                        culprit="",
                        priority=priority,
                        assignee=None,
                    ),
                    {},
                )

        @dataclass(frozen=True)
        class TestMetricGroupType(GroupType):
            type_id = 1
            slug = MetricIssue.slug
            description = "Metric alert"
            category = GroupCategory.METRIC_ALERT.value
            category_v2 = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDetectorHandler)
            released = True

        @dataclass(frozen=True)
        class TestCronsGroupType(GroupType):
            type_id = 2
            slug = MonitorIncidentType.slug
            description = "Crons"
            category = GroupCategory.CRON.value
            category_v2 = GroupCategory.OUTAGE.value
            detector_settings = DetectorSettings(handler=MockDetectorHandler)
            released = True

        @dataclass(frozen=True)
        class TestUptimeGroupType(GroupType):
            type_id = 3
            slug = UptimeDomainCheckFailure.slug
            description = "Uptime"
            category = GroupCategory.UPTIME.value
            category_v2 = GroupCategory.OUTAGE.value
            detector_settings = DetectorSettings(handler=MockDetectorHandler)
            released = True

        # Should not be included in the response
        @dataclass(frozen=True)
        class TestPerformanceGroupType(GroupType):
            type_id = 4
            slug = PerformanceSlowDBQueryGroupType.slug
            description = "Performance"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value
            released = True

    def tearDown(self):
        super().tearDown()
        self.registry_patcher.stop()

    def test_simple(self):
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.data == [
            MetricIssue.slug,
            MonitorIncidentType.slug,
            UptimeDomainCheckFailure.slug,
        ]
