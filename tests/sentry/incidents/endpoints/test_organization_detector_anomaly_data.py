from unittest.mock import patch

from sentry.incidents.grouptype import MetricIssue
from sentry.snuba.subscriptions import create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import DataSourceDetector
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class OrganizationDetectorAnomalyDataEndpointTest(BaseWorkflowTest, APITestCase):
    endpoint = "sentry-api-0-organization-detector-anomaly-data"

    def setUp(self):
        super().setUp()
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        self.data_condition_group = self.create_data_condition_group()
        with self.tasks():
            self.snuba_query = self.create_snuba_query()
            self.subscription = create_snuba_subscription(
                project=self.project,
                subscription_type="metrics_alerts",
                snuba_query=self.snuba_query,
            )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.subscription.id
        )
        self.detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricIssue.slug,
            workflow_condition_group=self.data_condition_group,
        )
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_missing_parameters(self):
        response = self.get_error_response(
            self.organization.slug, self.detector.id, end="1729179000.0", status_code=400
        )
        assert response.data["detail"] == "start and end parameters are required"

        response = self.get_error_response(
            self.organization.slug, self.detector.id, start="1729178100.0", status_code=400
        )
        assert response.data["detail"] == "start and end parameters are required"

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_invalid_parameters(self):
        response = self.get_error_response(
            self.organization.slug,
            self.detector.id,
            start="invalid",
            end="1729179000.0",
            status_code=400,
        )
        assert response.data["detail"] == "start and end must be valid timestamps"

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_no_subscription_found(self):
        # Delete the data source to simulate missing subscription
        DataSourceDetector.objects.filter(detector=self.detector).delete()
        response = self.get_error_response(
            self.organization.slug,
            self.detector.id,
            start="1729178100.0",
            end="1729179000.0",
            status_code=404,
        )
        assert response.data["detail"] == "Could not find query subscription for detector"

    @with_feature("organizations:anomaly-detection-threshold-data")
    @patch(
        "sentry.workflow_engine.endpoints.organization_detector_anomaly_data.get_anomaly_threshold_data_from_seer"
    )
    def test_seer_error(self, mock_get_data):
        mock_get_data.return_value = None

        response = self.get_error_response(
            self.organization.slug,
            self.detector.id,
            start="1729178100.0",
            end="1729179000.0",
            status_code=400,
        )
        assert response.data["detail"] == "Unable to fetch anomaly detection threshold data"

    @with_feature("organizations:anomaly-detection-threshold-data")
    @patch(
        "sentry.workflow_engine.endpoints.organization_detector_anomaly_data.get_anomaly_threshold_data_from_seer"
    )
    def test_successful_fetch(self, mock_get_data):
        mock_data = [
            {
                "external_alert_id": 24,
                "timestamp": 1729178100.0,
                "value": 0,
                "yhat_lower": 10.5,
                "yhat_upper": 20.5,
            }
        ]
        mock_get_data.return_value = mock_data

        response = self.get_success_response(
            self.organization.slug,
            self.detector.id,
            start="1729178100.0",
            end="1729179000.0",
        )

        assert response.data == {"data": mock_data}
        assert mock_get_data.call_args.kwargs["start"] == 1729178100.0
        assert mock_get_data.call_args.kwargs["end"] == 1729179000.0

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_permission_denied(self):
        self.login_as(self.create_user())

        self.get_error_response(
            self.organization.slug,
            self.detector.id,
            start="1729178100.0",
            end="1729179000.0",
            status_code=403,
        )

    def test_feature_flag_disabled(self):
        """Test that endpoint returns 404 when feature flag is disabled"""
        self.get_error_response(
            self.organization.slug,
            self.detector.id,
            start="1729178100.0",
            end="1729179000.0",
            status_code=404,
        )

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_invalid_detector_id(self):
        """Test that non-numeric detector IDs return 404"""
        self.get_error_response(
            self.organization.slug,
            "not-a-number",
            start="1729178100.0",
            end="1729179000.0",
            status_code=404,
        )


class OrganizationDetectorAnomalyDataLegacyAlertTest(BaseWorkflowTest, APITestCase):
    """Tests for the legacy_alert=true parameter to support legacy alert rules."""

    endpoint = "sentry-api-0-organization-detector-anomaly-data"

    def setUp(self):
        super().setUp()
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        with self.feature("organizations:incidents"), self.tasks():
            self.snuba_query = self.create_snuba_query()
            self.subscription = create_snuba_subscription(
                project=self.project,
                subscription_type="metrics_alerts",
                snuba_query=self.snuba_query,
            )
            self.alert_rule = self.create_alert_rule(
                organization=self.organization,
                projects=[self.project],
            )
            # Link the alert rule to the subscription via snuba_query
            self.alert_rule.snuba_query = self.snuba_query
            self.alert_rule.save()

    @with_feature("organizations:anomaly-detection-threshold-data")
    @patch(
        "sentry.workflow_engine.endpoints.organization_detector_anomaly_data.get_anomaly_threshold_data_from_seer"
    )
    def test_successful_fetch_legacy_alert(self, mock_get_data):
        """Test successful data fetch using legacy_alert=true parameter."""
        mock_data = [
            {
                "external_alert_id": 42,
                "timestamp": 1729178100.0,
                "value": 100,
                "yhat_lower": 50.0,
                "yhat_upper": 150.0,
            }
        ]
        mock_get_data.return_value = mock_data

        response = self.get_success_response(
            self.organization.slug,
            self.alert_rule.id,
            legacy_alert="true",
            start="1729178100.0",
            end="1729179000.0",
        )

        assert response.data == {"data": mock_data}
        assert mock_get_data.call_args.kwargs["start"] == 1729178100.0
        assert mock_get_data.call_args.kwargs["end"] == 1729179000.0
        # Verify the subscription passed to seer is the one linked to the alert rule
        assert mock_get_data.call_args.kwargs["subscription"] == self.subscription

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_legacy_alert_not_found(self):
        """Test that non-existent alert rule ID returns 404."""
        self.get_error_response(
            self.organization.slug,
            999999,
            legacy_alert="true",
            start="1729178100.0",
            end="1729179000.0",
            status_code=404,
        )

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_legacy_alert_missing_subscription(self):
        """Test error when alert rule has no query subscription."""
        # Delete the subscription to simulate missing subscription
        self.subscription.delete()

        response = self.get_error_response(
            self.organization.slug,
            self.alert_rule.id,
            legacy_alert="true",
            start="1729178100.0",
            end="1729179000.0",
            status_code=404,
        )
        assert response.data["detail"] == "Could not find query subscription for alert rule"

    @with_feature("organizations:anomaly-detection-threshold-data")
    @patch(
        "sentry.workflow_engine.endpoints.organization_detector_anomaly_data.get_anomaly_threshold_data_from_seer"
    )
    def test_legacy_alert_seer_error(self, mock_get_data):
        """Test error handling when Seer returns None."""
        mock_get_data.return_value = None

        response = self.get_error_response(
            self.organization.slug,
            self.alert_rule.id,
            legacy_alert="true",
            start="1729178100.0",
            end="1729179000.0",
            status_code=400,
        )
        assert response.data["detail"] == "Unable to fetch anomaly detection threshold data"

    @with_feature("organizations:anomaly-detection-threshold-data")
    def test_legacy_alert_permission_denied(self):
        """Test that users without access get 403."""
        self.login_as(self.create_user())

        self.get_error_response(
            self.organization.slug,
            self.alert_rule.id,
            legacy_alert="true",
            start="1729178100.0",
            end="1729179000.0",
            status_code=403,
        )

    def test_legacy_alert_feature_flag_disabled(self):
        """Test that endpoint returns 404 when feature flag is disabled."""
        self.get_error_response(
            self.organization.slug,
            self.alert_rule.id,
            legacy_alert="true",
            start="1729178100.0",
            end="1729179000.0",
            status_code=404,
        )
