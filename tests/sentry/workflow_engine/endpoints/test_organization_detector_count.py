from collections.abc import Mapping

from django.urls import reverse

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.models.environment import Environment
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.workflow_engine.types import APIGate, DetectorAPIOperation, FeatureGate
from tests.sentry.workflow_engine.endpoints.test_helpers import (
    GATE_FEATURE,
    override_detector_api_availability,
)


@cell_silo_test
class OrganizationDetectorCountTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-count"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )

    def test_simple(self) -> None:
        # Create active detectors
        self.create_detector(
            project=self.project,
            name="Active Detector 1",
            type=MetricIssue.slug,
            enabled=True,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
        )

        # Create inactive detector
        self.create_detector(
            project=self.project,
            name="Inactive Detector",
            type=UptimeDomainCheckFailure.slug,
            enabled=False,
            config={
                "mode": 1,
                "environment": "production",
                "recovery_threshold": 1,
                "downtime_threshold": 3,
            },
        )

        response = self.get_success_response(self.organization.slug)

        # includes 2 default detectors (error and issue stream)
        assert response.data == {
            "active": 3,
            "inactive": 1,
            "total": 4,
        }

    def test_filtered_by_type(self) -> None:
        # Create detectors of different types
        self.create_detector(
            project=self.project,
            name="Metric Detector 1",
            type=MetricIssue.slug,
            enabled=True,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
        )
        self.create_detector(
            project=self.project,
            name="Metric Detector 2",
            type=MetricIssue.slug,
            enabled=False,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
        )
        self.create_detector(
            project=self.project,
            name="Error Detector",
            type=ErrorGroupType.slug,
            enabled=True,
            config={},
        )
        self.create_detector(
            project=self.project,
            name="Uptime Detector",
            type=UptimeDomainCheckFailure.slug,
            enabled=True,
            config={
                "mode": 1,
                "environment": "production",
                "recovery_threshold": 1,
                "downtime_threshold": 3,
            },
        )

        # Test with single type filter
        response = self.get_success_response(
            self.organization.slug, qs_params={"type": MetricIssue.slug}
        )
        assert response.data == {
            "active": 1,
            "inactive": 1,
            "total": 2,
        }

        # Test with multiple type filters
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"type": [ErrorGroupType.slug, UptimeDomainCheckFailure.slug]},
        )
        assert response.data == {
            "active": 2,
            "inactive": 0,
            "total": 2,
        }

    def test_no_detectors(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data == {
            "active": 0,
            "inactive": 0,
            "total": 0,
        }

    def test_no_projects_access(self) -> None:
        # Create another organization with detectors
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.create_detector(
            project_id=other_project.id,
            name="Other Org Detector",
            type=MetricIssue.slug,
            enabled=True,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
        )

        # Test with no project access
        # Only picks up project default detectors
        response = self.get_success_response(self.organization.slug, qs_params={"project": []})
        assert response.data == {
            "active": 2,
            "inactive": 0,
            "total": 2,
        }

    def test_read_excluded_types_are_not_counted(self) -> None:
        for enabled in (True, False):
            self.create_detector(
                project=self.project,
                type=MetricIssue.slug,
                enabled=enabled,
                config={"detection_type": AlertRuleDetectionType.STATIC.value},
            )

        cases: tuple[tuple[str, Mapping[DetectorAPIOperation, APIGate]], ...] = (
            ("get", {DetectorAPIOperation.GET: False}),
            ("list", {DetectorAPIOperation.LIST: False}),
            ("list_feature_gate", {DetectorAPIOperation.LIST: FeatureGate(GATE_FEATURE)}),
        )
        # LIST also requires GET, so denying either hides the type from counts
        for label, availability in cases:
            with (
                self.subTest(gate=label),
                self.feature({GATE_FEATURE: False}),
                override_detector_api_availability(MetricIssue.slug, availability),
            ):
                # Only the project's default error and issue stream detectors remain
                response = self.get_success_response(self.organization.slug)
                assert response.data == {"active": 2, "inactive": 0, "total": 2}
                response = self.get_success_response(
                    self.organization.slug, qs_params={"type": MetricIssue.slug}
                )
                assert response.data == {"active": 0, "inactive": 0, "total": 0}

    def test_feature_gate_is_scoped_to_each_organization_request(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_team = self.create_team(organization=other_org)
        other_project = self.create_project(organization=other_org, teams=[other_team])
        detector_ids_by_org: dict[int, set[str]] = {}
        for project in (self.project, other_project):
            detector_ids_by_org[project.organization_id] = {
                str(
                    self.create_detector(
                        project=project,
                        type=MetricIssue.slug,
                        enabled=enabled,
                        config={"detection_type": AlertRuleDetectionType.STATIC.value},
                    ).id
                )
                for enabled in (True, False)
            }

        with (
            self.feature({GATE_FEATURE: [self.organization.slug]}),
            override_detector_api_availability(
                MetricIssue.slug,
                {operation: FeatureGate(GATE_FEATURE) for operation in DetectorAPIOperation},
            ),
        ):
            for organization, project in (
                (other_org, other_project),
                (self.organization, self.project),
            ):
                with self.subTest(organization=organization.slug):
                    query = {"project": project.id, "type": MetricIssue.slug}
                    count_response = self.get_success_response(organization.slug, qs_params=query)
                    list_url = reverse(
                        "sentry-api-0-organization-detector-index", args=[organization.slug]
                    )
                    list_response = self.client.get(list_url, query)
                    assert list_response.status_code == 200, list_response.data

                    enabled = organization.id == self.organization.id
                    expected_ids = detector_ids_by_org[organization.id] if enabled else set()
                    assert {detector["id"] for detector in list_response.data} == expected_ids
                    assert count_response.data == {
                        "active": 1 if enabled else 0,
                        "inactive": 1 if enabled else 0,
                        "total": 2 if enabled else 0,
                    }
                    assert int(list_response["X-Hits"]) == count_response.data["total"]
                    assert len(list_response.data) == count_response.data["total"]
