from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class OrganizationAlertRuleDetectorAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rule-detector-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        self.project = self.create_project(organization=self.organization)

        self.detector_1 = self.create_detector(project=self.project)
        self.detector_2 = self.create_detector(project=self.project)
        self.detector_3 = self.create_detector(project=self.project)

        self.alert_rule_detector_1 = self.create_alert_rule_detector(
            alert_rule_id=12345, detector=self.detector_1
        )
        self.alert_rule_detector_2 = self.create_alert_rule_detector(
            rule_id=67890, detector=self.detector_2
        )
        self.alert_rule_detector_3 = self.create_alert_rule_detector(
            alert_rule_id=11111, detector=self.detector_3
        )

        # Create detector in different organization to test filtering
        self.other_org = self.create_organization()
        self.other_project = self.create_project(organization=self.other_org)
        self.other_detector = self.create_detector(project=self.other_project)
        self.other_alert_rule_detector = self.create_alert_rule_detector(
            alert_rule_id=99999, detector=self.other_detector
        )


@region_silo_test
class OrganizationAlertRuleDetectorIndexGetTest(OrganizationAlertRuleDetectorAPITestCase):
    def test_get_with_detector_id_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug, detector_id=str(self.detector_1.id)
        )
        assert response.data == serialize(self.alert_rule_detector_1, self.user)

    def test_get_with_alert_rule_id_filter(self) -> None:
        response = self.get_success_response(self.organization.slug, alert_rule_id="12345")

        assert response.data["alertRuleId"] == "12345"
        assert response.data["ruleId"] is None
        assert response.data["detectorId"] == str(self.detector_1.id)

    def test_get_with_rule_id_filter(self) -> None:
        response = self.get_success_response(self.organization.slug, rule_id="67890")

        assert response.data["ruleId"] == "67890"
        assert response.data["alertRuleId"] is None
        assert response.data["detectorId"] == str(self.detector_2.id)

    def test_get_with_multiple_filters(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            detector_id=str(self.detector_1.id),
            alert_rule_id="12345",
        )

        assert response.data == serialize(self.alert_rule_detector_1, self.user)

    def test_get_with_multiple_filters_with_invalid_filter(self) -> None:
        self.get_error_response(
            self.organization.slug,
            detector_id=str(self.detector_1.id),
            alert_rule_id="this is not a valid ID",
        )

    def test_get_with_nonexistent_detector_id(self) -> None:
        self.get_error_response(self.organization.slug, detector_id="99999", status_code=404)

    def test_get_with_nonexistent_alert_rule_id(self) -> None:
        self.get_error_response(self.organization.slug, alert_rule_id="99999", status_code=404)

    def test_get_with_nonexistent_rule_id(self) -> None:
        self.get_error_response(self.organization.slug, rule_id="99999", status_code=404)

    def test_organization_isolation(self) -> None:
        self.get_error_response(
            self.organization.slug, detector_id=str(self.other_detector.id), status_code=404
        )

    def test_get_without_any_filter(self) -> None:
        self.get_error_response(self.organization.slug, status_code=400)

    def test_fallback_with_fake_alert_rule_id(self) -> None:
        """
        Test that when an alert rule doesn't exist, the endpoint falls back to looking up
        the Detector by subtracting 10^9 from the alert_rule_id.
        """
        # Create a detector with no AlertRuleDetector mapping
        detector = self.create_detector(project=self.project)

        # Calculate the fake alert_rule_id
        fake_alert_rule_id = get_fake_id_from_object_id(detector.id)

        # Query using the fake alert_rule_id
        response = self.get_success_response(
            self.organization.slug, alert_rule_id=str(fake_alert_rule_id)
        )

        # Should return a fake AlertRuleDetector response
        assert response.data == {
            "detectorId": str(detector.id),
            "alertRuleId": str(fake_alert_rule_id),
            "ruleId": None,
        }

    def test_fallback_with_nonexistent_detector(self) -> None:
        # Use a fake alert_rule_id that won't map to any real detector
        nonexistent_fake_id = get_fake_id_from_object_id(999999)
        self.get_error_response(
            self.organization.slug, alert_rule_id=str(nonexistent_fake_id), status_code=404
        )
