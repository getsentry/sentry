from dataclasses import dataclass
from typing import Never
from unittest.mock import patch

from sentry.issues.grouptype import GroupCategory, GroupType, GroupTypeRegistry
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.handlers.detector import (
    DetectorHandler,
    DetectorOccurrence,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import DataConditionGroupEvaluation, DetectorEvaluation
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    DetectorAPIOperation,
    DetectorPriorityLevel,
    DetectorSettings,
    FeatureGate,
)


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
                self, data_packet: DataPacket[dict[Never, Never]]
            ) -> GroupedDetectorEvaluationResult:
                return GroupedDetectorEvaluationResult(
                    result={
                        None: DetectorEvaluation(
                            result=None,
                            data=DetectorEvaluationData(
                                group_key=None,
                                trigger_group_evaluation=DataConditionGroupEvaluation(
                                    result=True,
                                    triggered=True,
                                    data={"condition_evaluations": [], "logic_type": "any"},
                                ),
                                event_data=None,
                            ),
                            triggered=True,
                            priority=DetectorPriorityLevel.HIGH,
                        )
                    },
                    tainted=False,
                )

            def extract_value(self, data_packet: DataPacket[dict[Never, Never]]) -> bool:
                return True

            def create_occurrence(
                self,
                evaluation_result: DataConditionGroupEvaluation,
                data_packet: DataPacket[dict[Never, Never]],
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

        # TODO - each of these types should be broken out into their individual modules
        @dataclass(frozen=True)
        class TestMetricGroupType(GroupType):
            type_id = 1
            slug = "test_metric_issue"
            description = "Metric alert"
            category = GroupCategory.METRIC.value
            released = True

        @dataclass(frozen=True)
        class TestCronsGroupType(GroupType):
            type_id = 2
            slug = "test_monitor_check_in_failure"
            description = "Crons"
            category = GroupCategory.OUTAGE.value
            released = True

        @dataclass(frozen=True)
        class TestUptimeGroupType(GroupType):
            type_id = 3
            slug = "test_uptime_domain_failure"
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

    def test_get_excluded_type_is_not_returned(self) -> None:
        excluded_slug = self.expected_type_slugs[0]
        settings = detector_settings_registry.get(excluded_slug)

        class ExcludedDetectorSettings(DetectorSettings):
            handler = settings.handler
            api_availability = {DetectorAPIOperation.GET: False}

        with patch.dict(
            detector_settings_registry.registrations, {excluded_slug: ExcludedDetectorSettings}
        ):
            response = self.get_success_response(self.organization.slug)
            assert response.data == self.expected_type_slugs[1:]

    def test_list_exclusion_does_not_affect_type_discovery(self) -> None:
        excluded_slug = self.expected_type_slugs[0]
        settings = detector_settings_registry.get(excluded_slug)

        class ExcludedDetectorSettings(DetectorSettings):
            handler = settings.handler
            api_availability = {DetectorAPIOperation.LIST: False}

        with patch.dict(
            detector_settings_registry.registrations, {excluded_slug: ExcludedDetectorSettings}
        ):
            response = self.get_success_response(self.organization.slug)
            assert response.data == self.expected_type_slugs

    def test_list_feature_gate_does_not_affect_type_discovery(self) -> None:
        feature_name = "organizations:workflow-engine-log-evaluations"
        gated_slug = self.expected_type_slugs[0]
        settings = detector_settings_registry.get(gated_slug)

        class GatedDetectorSettings(DetectorSettings):
            handler = settings.handler
            api_availability = {
                DetectorAPIOperation.GET: True,
                DetectorAPIOperation.LIST: FeatureGate(feature_name),
            }

        with (
            self.feature({feature_name: False}),
            patch.dict(
                detector_settings_registry.registrations, {gated_slug: GatedDetectorSettings}
            ),
        ):
            response = self.get_success_response(self.organization.slug)
            assert response.data == self.expected_type_slugs

    def test_get_feature_gate_is_scoped_to_each_organization_request(self) -> None:
        other_org = self.create_organization(owner=self.user)
        feature_name = "organizations:workflow-engine-log-evaluations"
        gated_slug = self.expected_type_slugs[0]
        settings = detector_settings_registry.get(gated_slug)

        class GatedDetectorSettings(DetectorSettings):
            handler = settings.handler
            api_availability = {
                DetectorAPIOperation.GET: FeatureGate(feature_name),
                DetectorAPIOperation.LIST: True,
            }

        with (
            self.feature({feature_name: [self.organization.slug]}),
            patch.dict(
                detector_settings_registry.registrations, {gated_slug: GatedDetectorSettings}
            ),
        ):
            for organization in (self.organization, other_org, self.organization, other_org):
                with self.subTest(organization=organization.slug):
                    response = self.get_success_response(organization.slug)
                    expected_slugs = (
                        self.expected_type_slugs
                        if organization.id == self.organization.id
                        else self.expected_type_slugs[1:]
                    )
                    assert response.data == expected_slugs
