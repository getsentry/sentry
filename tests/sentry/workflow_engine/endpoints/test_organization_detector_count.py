from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.models.environment import Environment
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.uptime.grouptype import UptimeDomainCheckFailure


@region_silo_test
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
        self.create_detector(
            project=self.project,
            name="Active Detector 2",
            type=ErrorGroupType.slug,
            enabled=True,
            config={},
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

        assert response.data == {
            "active": 2,
            "deactive": 1,
            "total": 3,
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
            "deactive": 1,
            "total": 2,
        }

        # Test with multiple type filters
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"type": [ErrorGroupType.slug, UptimeDomainCheckFailure.slug]},
        )
        assert response.data == {
            "active": 2,
            "deactive": 0,
            "total": 2,
        }

    def test_no_detectors(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data == {
            "active": 0,
            "deactive": 0,
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
        response = self.get_success_response(self.organization.slug, qs_params={"project": []})
        assert response.data == {
            "active": 0,
            "deactive": 0,
            "total": 0,
        }
