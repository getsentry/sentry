from unittest.mock import patch

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector
from tests.sentry.incidents.endpoints.test_organization_alert_rule_index import AlertRuleBase

pytestmark = [requires_snuba]


class OrganizationDetectorAnomalyDataEndpointTest(AlertRuleBase):
    endpoint = "sentry-api-0-organization-detector-anomaly-data"

    def setUp(self):
        super().setUp()
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        self.alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            threshold_type=AlertRuleThresholdType.ABOVE,
        )

        # Create a detector for the alert rule
        self.detector = Detector.objects.create(
            project=self.project,
            name="Test Detector",
            type=MetricIssue.slug,
            config={"threshold_period": 1, "detection_type": "static"},
            created_by_id=self.user.id,
        )

        # Link the detector to the alert rule's query subscription
        subscription = self.alert_rule.snuba_query.subscriptions.first()
        assert subscription is not None
        data_source = DataSource.objects.create(
            organization_id=self.organization.id,
            type="snuba_query_subscription",
            source_id=str(subscription.id),
        )
        DataSourceDetector.objects.create(
            detector=self.detector,
            data_source=data_source,
        )

    def test_missing_parameters(self):
        with self.feature("organizations:incidents"):
            response = self.get_error_response(
                self.organization.slug, self.detector.id, end="1729179000.0", status_code=400
            )
            assert response.data["detail"] == "start and end parameters are required"

            response = self.get_error_response(
                self.organization.slug, self.detector.id, start="1729178100.0", status_code=400
            )
            assert response.data["detail"] == "start and end parameters are required"

    def test_invalid_parameters(self):
        with self.feature("organizations:incidents"):
            response = self.get_error_response(
                self.organization.slug,
                self.detector.id,
                start="invalid",
                end="1729179000.0",
                status_code=400,
            )
            assert response.data["detail"] == "start and end must be valid timestamps"

    def test_no_subscription_found(self):
        # Delete the data source to simulate missing subscription
        DataSourceDetector.objects.filter(detector=self.detector).delete()

        with self.feature("organizations:incidents"):
            response = self.get_error_response(
                self.organization.slug,
                self.detector.id,
                start="1729178100.0",
                end="1729179000.0",
                status_code=500,
            )
        assert response.data["detail"] == "Internal Error"

    @patch(
        "sentry.incidents.endpoints.organization_alert_rule_anomaly_data.get_anomaly_threshold_data_from_seer"
    )
    def test_seer_error(self, mock_get_data):
        mock_get_data.return_value = None

        with self.feature("organizations:incidents"):
            response = self.get_error_response(
                self.organization.slug,
                self.detector.id,
                start="1729178100.0",
                end="1729179000.0",
                status_code=400,
            )
        assert response.data["detail"] == "Unable to fetch anomaly detection threshold data"

    @patch(
        "sentry.incidents.endpoints.organization_alert_rule_anomaly_data.get_anomaly_threshold_data_from_seer"
    )
    def test_successful_fetch(self, mock_get_data):
        mock_data = [{"timestamp": 1729178100.0, "yhat_lower": 10.5, "yhat_upper": 20.5}]
        mock_get_data.return_value = mock_data

        with self.feature("organizations:incidents"):
            response = self.get_success_response(
                self.organization.slug,
                self.detector.id,
                start="1729178100.0",
                end="1729179000.0",
            )

        assert response.data == {"data": mock_data}
        assert mock_get_data.call_args.kwargs["start"] == 1729178100.0
        assert mock_get_data.call_args.kwargs["end"] == 1729179000.0

    def test_permission_denied(self):
        self.login_as(self.create_user())

        self.get_error_response(
            self.organization.slug,
            self.detector.id,
            start="1729178100.0",
            end="1729179000.0",
            status_code=403,
        )
