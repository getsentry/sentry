from collections.abc import Mapping
from dataclasses import dataclass
from typing import Never
from unittest.mock import patch

from sentry.issues.grouptype import GroupCategory, GroupType, GroupTypeRegistry
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.handlers.detector import (
    DetectorEvaluations,
    DetectorHandler,
    DetectorOccurrence,
)
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import DataConditionGroupEvaluation, DetectorEvaluation
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    APIGate,
    DetectorAPIOperation,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
    DetectorType,
    FeatureGate,
)
from tests.sentry.workflow_engine.endpoints.test_helpers import GATE_FEATURE


@cell_silo_test
class OrganizationDetectorTypesAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-detector-type-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        self.registry_patcher = patch(
            "sentry.workflow_engine.endpoints.organization_detector_types.grouptype.registry",
            new=GroupTypeRegistry(),
        )
        self.registry_patcher.start()

        self.detector_settings_patcher = patch.dict(detector_settings_registry.registrations)
        self.detector_settings_patcher.start()

        class MockDetectorHandler(DetectorHandler[dict[Never, Never], bool]):
            def evaluate(
                self,
                data_packet: DataPacket[dict[Never, Never]],
                values: Mapping[DetectorGroupKey, bool],
            ) -> DetectorEvaluations:
                return DetectorEvaluations(
                    evaluations={
                        None: DetectorEvaluation.create_issue(
                            None,
                            DetectorPriorityLevel.HIGH,
                            DataConditionGroupEvaluation(
                                result=True,
                                triggered=True,
                                data={"condition_evaluations": [], "logic_type": "any"},
                            ),
                        )
                    },
                    tainted=False,
                )

            def extract_value(self, data_packet: DataPacket[dict[Never, Never]]) -> bool:
                return True

            def create_occurrence(
                self,
                evaluation: DetectorEvaluation,
                data_packet: DataPacket[dict[Never, Never]],
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
                        priority=evaluation.priority,
                        assignee=None,
                    ),
                    {},
                )

        # TODO - each of these types should be broken out into their individual modules
        @dataclass(frozen=True)
        class TestMetricGroupType(GroupType):
            type_id = 1
            slug = DetectorType.METRIC_ALERT
            description = "Metric alert"
            category = GroupCategory.METRIC.value
            released = True

        @dataclass(frozen=True)
        class TestCronsGroupType(GroupType):
            type_id = 2
            slug = DetectorType.CRON_MONITOR_FAILURE
            description = "Crons"
            category = GroupCategory.OUTAGE.value
            released = True

        @dataclass(frozen=True)
        class TestUptimeGroupType(GroupType):
            type_id = 3
            slug = DetectorType.UPTIME_DOMAIN_CHECK_FAILURE
            description = "Uptime"
            category = GroupCategory.OUTAGE.value
            released = True

        # Should not be included in the response, it has no registered detector settings
        @dataclass(frozen=True)
        class TestPerformanceGroupType(GroupType):
            type_id = 4
            slug = "test_performance_slow_db_query"
            description = "Performance"
            category = GroupCategory.DB_QUERY.value
            released = True

        class MockDetectorSettings(DetectorSettings):
            handler = MockDetectorHandler

        for group_type in (TestMetricGroupType, TestCronsGroupType, TestUptimeGroupType):
            detector_settings_registry.registrations.pop(group_type.slug)
            detector_settings_registry.register(group_type.slug)(MockDetectorSettings)

        self.expected_type_slugs = sorted(
            [TestMetricGroupType.slug, TestCronsGroupType.slug, TestUptimeGroupType.slug]
        )

    def tearDown(self) -> None:
        super().tearDown()
        self.detector_settings_patcher.stop()
        self.registry_patcher.stop()

    def test_simple(self) -> None:
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.data == self.expected_type_slugs

    def gate_first_type(self, availability: Mapping[DetectorAPIOperation, APIGate]) -> None:
        # The fixture types share one settings class, so give the gated type its own subclass.
        # setUp's patch.dict restores the registrations afterwards.
        gated_slug = self.expected_type_slugs[0]

        class GatedDetectorSettings(DetectorSettings):
            handler = detector_settings_registry.get(gated_slug).handler
            api_availability = availability

        detector_settings_registry.registrations[gated_slug] = GatedDetectorSettings

    def test_get_excluded_type_is_not_returned(self) -> None:
        self.gate_first_type({DetectorAPIOperation.GET: False})
        response = self.get_success_response(self.organization.slug)
        assert response.data == self.expected_type_slugs[1:]

    def test_list_exclusion_does_not_affect_type_discovery(self) -> None:
        self.gate_first_type({DetectorAPIOperation.LIST: False})
        response = self.get_success_response(self.organization.slug)
        assert response.data == self.expected_type_slugs

    def test_get_feature_gate_is_scoped_to_each_organization_request(self) -> None:
        other_org = self.create_organization(owner=self.user)
        self.gate_first_type({DetectorAPIOperation.GET: FeatureGate(GATE_FEATURE)})
        with self.feature({GATE_FEATURE: [self.organization.slug]}):
            response = self.get_success_response(self.organization.slug)
            assert response.data == self.expected_type_slugs
            response = self.get_success_response(other_org.slug)
            assert response.data == self.expected_type_slugs[1:]
