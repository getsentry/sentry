from django.utils import timezone
from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import UptimeSubscription, get_uptime_subscription
from sentry.uptime.types import UptimeMonitorMode
from sentry.workflow_engine.models import Detector


def _get_valid_data(project_id, environment_name, **overrides):
    data = {
        "projectId": project_id,
        "name": "Test Uptime Detector",
        "type": UptimeDomainCheckFailure.slug,
        "dataSources": [
            {
                "timeout_ms": 30000,
                "name": "Test Uptime Detector",
                "url": "https://www.google.com",
                "interval_seconds": UptimeSubscription.IntervalSeconds.ONE_MINUTE,
            }
        ],
        "conditionGroup": {
            "logicType": "any",
            "conditions": [
                {"comparison": 1, "type": "eq", "condition_result": "high"},
                {"comparison": 0, "type": "eq", "condition_result": "ok"},
            ],
        },
        "config": {
            "environment": environment_name,
            "mode": UptimeMonitorMode.MANUAL.value,
            "recovery_threshold": 1,
            "downtime_threshold": 1,
        },
    }
    data.update(overrides)
    return data


class UptimeDetectorBaseTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.environment = self.create_environment(
            organization_id=self.organization.id, name="production"
        )
        self.project = self.create_project()

        self.uptime_subscription = self.create_uptime_subscription(
            url="https://www.google.com",
            interval_seconds=UptimeSubscription.IntervalSeconds.ONE_MINUTE,
            timeout_ms=30000,
            method=UptimeSubscription.SupportedHTTPMethods.GET,
            headers=[],
            body=None,
            trace_sampling=False,
        )

        self.detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            uptime_subscription=self.uptime_subscription,
            name="Test Detector",
        )


class OrganizationDetectorDetailsPutTest(UptimeDetectorBaseTest):
    endpoint = "sentry-api-0-organization-detector-details"

    def setUp(self) -> None:
        super().setUp()

        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_update_non_superuser_cannot_change_mode_via_endpoint(self) -> None:
        """Integration test: non-superuser cannot change mode via API endpoint."""
        # Create a detector with MANUAL mode specifically for this test
        manual_uptime_subscription = self.create_uptime_subscription(
            url="https://manual-test-site.com",
            interval_seconds=UptimeSubscription.IntervalSeconds.ONE_MINUTE,
            timeout_ms=30000,
        )
        manual_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            uptime_subscription=manual_uptime_subscription,
            name="Manual Test Detector",
            mode=UptimeMonitorMode.MANUAL,
        )

        assert manual_detector.workflow_condition_group is not None
        invalid_data = {
            "id": manual_detector.id,
            "projectId": self.project.id,
            "name": "Manual Test Detector",
            "type": UptimeDomainCheckFailure.slug,
            "dateCreated": manual_detector.date_added,
            "dateUpdated": timezone.now(),
            "conditionGroup": {
                "id": manual_detector.workflow_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": {
                "environment": self.environment.name,
                "mode": UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,
                "recovery_threshold": 1,
                "downtime_threshold": 1,
            },
        }

        response = self.get_error_response(
            self.organization.slug,
            manual_detector.id,
            **invalid_data,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
        )

        assert "config" in response.data
        assert "mode" in response.data["config"]
        assert "Only superusers can modify `mode`" in str(response.data["config"]["mode"])

        # Verify that mode was NOT changed
        manual_detector.refresh_from_db()
        assert manual_detector.config["mode"] == UptimeMonitorMode.MANUAL.value

    def test_update(self) -> None:
        assert self.detector.workflow_condition_group is not None
        valid_data = {
            "id": self.detector.id,
            "projectId": self.project.id,
            "name": "Test Uptime Detector",
            "type": UptimeDomainCheckFailure.slug,
            "dateCreated": self.detector.date_added,
            "dateUpdated": timezone.now(),
            "dataSources": [
                {
                    "timeout_ms": 15000,
                }
            ],
            "conditionGroup": {
                "id": self.detector.workflow_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": self.detector.config,
        }

        self.get_success_response(
            self.organization.slug,
            self.detector.id,
            **valid_data,
            status_code=status.HTTP_200_OK,
            method="PUT",
        )

        updated_sub: UptimeSubscription = UptimeSubscription.objects.get(
            id=self.uptime_subscription.id
        )
        assert updated_sub.timeout_ms == 15000

    def test_update_auto_detected_switches_to_manual(self) -> None:
        """Test that when a user modifies an AUTO_DETECTED detector, it automatically switches to MANUAL mode."""
        # Create an AUTO_DETECTED detector
        auto_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Auto Detected Monitor",
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )

        assert auto_detector.workflow_condition_group is not None
        # User modifies the detector (e.g., changes name)
        # Even if they pass the current config (including AUTO_DETECTED mode),
        # it should automatically switch to MANUAL for non-superusers
        valid_data = {
            "id": auto_detector.id,
            "projectId": self.project.id,
            "name": "User Modified Monitor",
            "type": UptimeDomainCheckFailure.slug,
            "dateCreated": auto_detector.date_added,
            "dateUpdated": timezone.now(),
            "conditionGroup": {
                "id": auto_detector.workflow_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": auto_detector.config,  # Passing existing config with AUTO_DETECTED mode
        }

        self.get_success_response(
            self.organization.slug,
            auto_detector.id,
            **valid_data,
            status_code=status.HTTP_200_OK,
            method="PUT",
        )

        # Verify that mode was automatically switched to MANUAL
        auto_detector.refresh_from_db()
        assert auto_detector.name == "User Modified Monitor"
        assert auto_detector.config["mode"] == UptimeMonitorMode.MANUAL.value

    def test_update_partial_config_preserves_other_fields(self) -> None:
        """Test that partial config updates preserve other config fields."""
        # Create a detector with specific config values
        detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Test Detector",
            mode=UptimeMonitorMode.MANUAL,
            recovery_threshold=8,
            downtime_threshold=10,
        )

        assert detector.workflow_condition_group is not None
        original_config = detector.config.copy()

        # Partially update only the downtime_threshold
        valid_data = {
            "id": detector.id,
            "projectId": self.project.id,
            "name": detector.name,
            "type": UptimeDomainCheckFailure.slug,
            "dateCreated": detector.date_added,
            "dateUpdated": timezone.now(),
            "conditionGroup": {
                "id": detector.workflow_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": {
                "downtime_threshold": 15,  # Only updating this field
            },
        }

        self.get_success_response(
            self.organization.slug,
            detector.id,
            **valid_data,
            status_code=status.HTTP_200_OK,
            method="PUT",
        )

        # Verify that downtime_threshold was updated but other fields preserved
        detector.refresh_from_db()
        assert detector.config["downtime_threshold"] == 15  # Updated
        assert (
            detector.config["recovery_threshold"] == original_config["recovery_threshold"]
        )  # Preserved
        assert detector.config["mode"] == original_config["mode"]  # Preserved
        assert detector.config["environment"] == original_config["environment"]  # Preserved

    def test_update_invalid(self) -> None:
        assert self.detector.workflow_condition_group is not None
        valid_data = {
            "id": self.detector.id,
            "projectId": self.project.id,
            "name": "Test Uptime Detector",
            "type": UptimeDomainCheckFailure.slug,
            "dateCreated": self.detector.date_added,
            "dateUpdated": timezone.now(),
            "dataSources": [
                {
                    "timeout_ms": 80000,
                }
            ],
            "conditionGroup": {
                "id": self.detector.workflow_condition_group.id,
                "organizationId": self.organization.id,
            },
            "config": self.detector.config,
        }

        response = self.get_error_response(
            self.organization.slug,
            self.detector.id,
            **valid_data,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
        )

        assert "dataSources" in response.data
        assert "Ensure this value is less than or equal to 60000." in str(
            response.data["dataSources"]
        )


class OrganizationDetectorIndexPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-index"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_create_detector_validation_error(self):
        invalid_data = _get_valid_data(
            self.project.id, self.environment.name, dataSources=[{"timeout_ms": 80000}]
        )

        response = self.get_error_response(
            self.organization.slug,
            **invalid_data,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert "dataSources" in response.data
        assert "Ensure this value is less than or equal to 60000" in str(
            response.data["dataSources"]
        )

    def test_create_detector(self):
        valid_data = _get_valid_data(
            self.project.id,
            self.environment.name,
        )

        response = self.get_success_response(
            self.organization.slug,
            **valid_data,
            status_code=status.HTTP_201_CREATED,
        )

        detector: Detector = Detector.objects.get(id=response.data["id"])
        created_sub: UptimeSubscription = get_uptime_subscription(detector)

        assert detector.name == "Test Uptime Detector"
        assert detector.type == UptimeDomainCheckFailure.slug
        assert detector.project_id == self.project.id

        assert created_sub.timeout_ms == 30000
        assert created_sub.url == "https://www.google.com"
        assert created_sub.interval_seconds == UptimeSubscription.IntervalSeconds.ONE_MINUTE

    def test_create_detector_optional_fields(self):
        valid_data = _get_valid_data(
            self.project.id,
            self.environment.name,
            dataSources=[
                {
                    "timeout_ms": 30000,
                    "name": "Test Uptime Detector",
                    "url": "https://www.google.com",
                    "interval_seconds": UptimeSubscription.IntervalSeconds.ONE_MINUTE,
                    "method": "PUT",
                    "headers": [["key", "value"]],
                    "body": "<html/>",
                    "trace_sampling": True,
                }
            ],
        )

        response = self.get_success_response(
            self.organization.slug,
            **valid_data,
            status_code=status.HTTP_201_CREATED,
        )
        detector: Detector = Detector.objects.get(id=response.data["id"])
        created_sub: UptimeSubscription = get_uptime_subscription(detector)

        assert detector.name == "Test Uptime Detector"
        assert detector.type == UptimeDomainCheckFailure.slug
        assert detector.project_id == self.project.id

        assert created_sub.timeout_ms == 30000
        assert created_sub.url == "https://www.google.com"
        assert created_sub.interval_seconds == UptimeSubscription.IntervalSeconds.ONE_MINUTE
        assert created_sub.method == "PUT"
        assert created_sub.headers == [["key", "value"]]
        assert created_sub.body == "<html/>"
        assert created_sub.trace_sampling is True

    def test_create_detector_non_superuser_cannot_set_auto_detected_mode(self):
        """Integration test: non-superuser cannot create with AUTO_DETECTED mode via API."""
        invalid_data = _get_valid_data(
            self.project.id,
            self.environment.name,
            config={
                "environment": self.environment.name,
                "mode": UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,
                "recovery_threshold": 1,
                "downtime_threshold": 1,
            },
        )

        response = self.get_error_response(
            self.organization.slug,
            **invalid_data,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert "config" in response.data
        assert "mode" in response.data["config"]
        assert "Only superusers can modify `mode`" in str(response.data["config"]["mode"])


class OrganizationDetectorIndexGetFilterTest(UptimeDetectorBaseTest):
    """Test that AUTO_DETECTED_ONBOARDING detectors are filtered from the list endpoint."""

    endpoint = "sentry-api-0-organization-detector-index"

    def test_filters_onboarding_detectors_from_list(self):
        """Test that AUTO_DETECTED_ONBOARDING detectors are not returned in the list."""
        # Create a manual detector (should be visible)
        manual_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Manual Detector",
            mode=UptimeMonitorMode.MANUAL,
        )

        # Create an AUTO_DETECTED_ACTIVE detector (should be visible)
        active_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Active Auto Detector",
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )

        # Create an AUTO_DETECTED_ONBOARDING detector (should be filtered out)
        onboarding_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Onboarding Auto Detector",
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
        )

        # Query the list endpoint
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id},
        )

        # Verify only manual and active detectors are returned (including base detector)
        returned_ids = {d["id"] for d in response.data}
        assert str(self.detector.id) in returned_ids  # Base detector from setUp
        assert str(manual_detector.id) in returned_ids
        assert str(active_detector.id) in returned_ids
        assert str(onboarding_detector.id) not in returned_ids

        # Verify the count is correct (5 = base detector + manual + active + default [issue stream + error])
        assert len(response.data) == 5

    def test_filters_onboarding_detectors_with_query(self):
        """Test that AUTO_DETECTED_ONBOARDING detectors are filtered even when using query filters."""
        # Create an onboarding detector with a searchable name
        self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Searchable Onboarding Detector",
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
        )

        # Try to search for it by name
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "Searchable"},
        )

        # Should not find it because it's filtered out
        assert len(response.data) == 0

    def test_filters_onboarding_detectors_by_id(self):
        """Test that AUTO_DETECTED_ONBOARDING detectors cannot be accessed via ID filtering."""
        # Create an onboarding detector
        onboarding_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Onboarding Detector",
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
        )

        # Create a manual detector for comparison
        manual_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Manual Detector",
            mode=UptimeMonitorMode.MANUAL,
        )

        # Try to query both by ID
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"id": [onboarding_detector.id, manual_detector.id]},
        )

        # Should only get the manual detector, not the onboarding one
        returned_ids = {d["id"] for d in response.data}
        assert str(manual_detector.id) in returned_ids
        assert str(onboarding_detector.id) not in returned_ids
        assert len(response.data) == 1


class OrganizationDetectorDetailsGetFilterTest(UptimeDetectorBaseTest):
    """Test that AUTO_DETECTED_ONBOARDING detectors return 404 from details endpoint."""

    endpoint = "sentry-api-0-organization-detector-details"

    def test_onboarding_detector_returns_404(self):
        """Test that accessing an AUTO_DETECTED_ONBOARDING detector by ID returns 404."""
        onboarding_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Onboarding Detector",
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
        )

        # Try to access it via the details endpoint
        self.get_error_response(
            self.organization.slug,
            onboarding_detector.id,
            status_code=status.HTTP_404_NOT_FOUND,
        )

    def test_active_auto_detected_is_accessible(self):
        """Test that AUTO_DETECTED_ACTIVE detectors are accessible via details endpoint."""
        active_detector = self.create_uptime_detector(
            project=self.project,
            env=self.environment,
            name="Active Auto Detector",
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )

        # Access it via the details endpoint
        response = self.get_success_response(
            self.organization.slug,
            active_detector.id,
        )

        # Verify we got the correct detector
        assert response.data["id"] == str(active_detector.id)
        assert response.data["name"] == "Active Auto Detector"
