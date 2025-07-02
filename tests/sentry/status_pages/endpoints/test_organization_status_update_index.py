from django.utils import timezone as django_timezone

from sentry.status_pages.models.status_update import StatusUpdate
from sentry.status_pages.models.status_update_detector import StatusUpdateDetector
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationStatusUpdateIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-status-page-status-updates"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.status_page = self.create_status_page(
            organization=self.organization,
            title="Test Status Page",
        )

    def test_list_status_updates(self):
        """Test listing status updates for a status page."""
        # Create some status updates
        status_update_1 = Factories.create_status_update(
            status_page=self.status_page,
            title="Service Degradation",
            description="We are experiencing increased latency",
            type=StatusUpdate.STATUS_UPDATE_TYPE_DEGRADED,
        )
        status_update_2 = Factories.create_status_update(
            status_page=self.status_page,
            title="Service Maintenance",
            description="Scheduled maintenance window",
            type=StatusUpdate.STATUS_UPDATE_TYPE_MAINTENANCE,
        )

        response = self.get_success_response(self.organization.slug, self.status_page.id)

        assert len(response.data) == 2
        assert response.data[0]["id"] == str(status_update_2.id)  # Most recent first
        assert response.data[0]["title"] == "Service Maintenance"
        assert response.data[0]["description"] == "Scheduled maintenance window"
        assert response.data[0]["type"] == "maintenance"
        assert response.data[0]["statusPageId"] == str(self.status_page.id)

        assert response.data[1]["id"] == str(status_update_1.id)
        assert response.data[1]["title"] == "Service Degradation"
        assert response.data[1]["description"] == "We are experiencing increased latency"
        assert response.data[1]["type"] == "degraded"

    def test_list_empty_status_updates(self):
        """Test listing when no status updates exist."""
        response = self.get_success_response(self.organization.slug, self.status_page.id)
        assert len(response.data) == 0

    def test_list_status_updates_other_org(self):
        """Test that status updates from other organizations are not returned."""
        other_org = self.create_organization(owner=self.user)
        other_status_page = self.create_status_page(
            organization=other_org,
            title="Other Status Page",
        )
        Factories.create_status_update(
            status_page=other_status_page,
            title="Other Status Update",
        )

        response = self.get_success_response(self.organization.slug, self.status_page.id)
        assert len(response.data) == 0

    def test_filter_by_status_type(self):
        """Test filtering status updates by status type."""
        Factories.create_status_update(
            status_page=self.status_page,
            title="Operational Update",
            type=StatusUpdate.STATUS_UPDATE_TYPE_OPERATIONAL,
        )
        Factories.create_status_update(
            status_page=self.status_page,
            title="Degraded Service",
            type=StatusUpdate.STATUS_UPDATE_TYPE_DEGRADED,
        )
        Factories.create_status_update(
            status_page=self.status_page,
            title="Service Down",
            type=StatusUpdate.STATUS_UPDATE_TYPE_DOWN,
        )

        # Filter by single status type
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            qs_params={"status_type": "degraded"},
        )
        assert len(response.data) == 1
        assert response.data[0]["type"] == "degraded"

        # Filter by multiple status types
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            qs_params={"status_type": ["operational", "down"]},
        )
        assert len(response.data) == 2
        types = [update["type"] for update in response.data]
        assert "operational" in types
        assert "down" in types

    def test_filter_by_detector(self):
        """Test filtering status updates by detector."""
        detector_1 = self.create_detector(project=self.project)
        detector_2 = self.create_detector(project=self.project)

        status_update_1 = Factories.create_status_update(status_page=self.status_page)
        status_update_2 = Factories.create_status_update(status_page=self.status_page)

        # Create detector associations
        StatusUpdateDetector.objects.create(
            status_update=status_update_1,
            detector=detector_1,
        )
        StatusUpdateDetector.objects.create(
            status_update=status_update_2,
            detector=detector_2,
        )

        # Filter by single detector
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            qs_params={"detector": detector_1.id},
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(status_update_1.id)

        # Filter by multiple detectors
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            qs_params={"detector": [detector_1.id, detector_2.id]},
        )
        assert len(response.data) == 2

    def test_invalid_detector_filter(self):
        """Test that invalid detector IDs return an error."""
        response = self.get_error_response(
            self.organization.slug,
            self.status_page.id,
            qs_params={"detector": "invalid"},
            status_code=400,
        )
        assert "Invalid detector ID format" in response.data["detail"]

    def test_create_status_update_minimal(self):
        """Test creating a status update with minimal data."""
        data = {
            "title": "New Status Update",
            "start_time": django_timezone.now().isoformat(),
            "type": "operational",
        }

        response = self.get_success_response(
            self.organization.slug, self.status_page.id, method="post", status_code=201, **data
        )

        assert response.data["title"] == "New Status Update"
        assert response.data["type"] == "operational"
        assert response.data["description"] is None
        assert response.data["endTime"] is None
        assert response.data["parentUpdateId"] is None
        assert response.data["shouldNotifySubscribersNow"] is False
        assert response.data["shouldNotifySubscribersAtEnd"] is False
        assert response.data["shouldNotifySubscribers24hBefore"] is False
        assert response.data["statusPageId"] == str(self.status_page.id)

        # Verify it was created in the database
        status_update = StatusUpdate.objects.get(id=response.data["id"])
        assert status_update.title == "New Status Update"
        assert status_update.status_page == self.status_page

    def test_create_status_update_full(self):
        """Test creating a status update with all fields."""
        end_time = django_timezone.now() + django_timezone.timedelta(hours=2)
        data = {
            "title": "Full Status Update",
            "description": "A comprehensive status update",
            "type": "maintenance",
            "start_time": django_timezone.now().isoformat(),
            "end_time": end_time.isoformat(),
            "should_notify_subscribers_now": True,
            "should_notify_subscribers_at_end": True,
            "should_notify_subscribers_24h_before": True,
        }

        response = self.get_success_response(
            self.organization.slug, self.status_page.id, method="post", status_code=201, **data
        )

        assert response.data["title"] == "Full Status Update"
        assert response.data["description"] == "A comprehensive status update"
        assert response.data["type"] == "maintenance"
        assert response.data["shouldNotifySubscribersNow"] is True
        assert response.data["shouldNotifySubscribersAtEnd"] is True
        assert response.data["shouldNotifySubscribers24hBefore"] is True

        # Verify it was created in the database
        status_update = StatusUpdate.objects.get(id=response.data["id"])
        assert status_update.title == "Full Status Update"
        assert status_update.description == "A comprehensive status update"
        assert status_update.type == "maintenance"

    def test_create_status_update_with_parent(self):
        """Test creating a status update with a parent update."""
        parent_update = Factories.create_status_update(
            status_page=self.status_page,
            title="Parent Update",
        )

        data = {
            "title": "Child Update",
            "start_time": django_timezone.now().isoformat(),
            "type": "operational",
            "parent_update": parent_update.id,
        }

        response = self.get_success_response(
            self.organization.slug, self.status_page.id, method="post", status_code=201, **data
        )

        assert response.data["title"] == "Child Update"
        assert response.data["parentUpdateId"] == str(parent_update.id)

        # Verify it was created in the database
        status_update = StatusUpdate.objects.get(id=response.data["id"])
        assert status_update.parent_update == parent_update

    def test_create_status_update_missing_title(self):
        """Test creating a status update without required title."""
        data = {
            "type": "operational",
        }

        response = self.get_error_response(
            self.organization.slug, self.status_page.id, method="post", status_code=400, **data
        )
        assert "title" in response.data

    def test_create_status_update_missing_type(self):
        """Test creating a status update without required type."""
        data = {
            "title": "Test Update",
        }

        response = self.get_error_response(
            self.organization.slug, self.status_page.id, method="post", status_code=400, **data
        )
        assert "type" in response.data

    def test_create_status_update_invalid_status_page(self):
        """Test creating a status update with invalid status page."""
        data = {
            "title": "Test Update",
            "type": "operational",
        }

        response = self.get_error_response(
            self.organization.slug, 99999, method="post", status_code=404, **data
        )
        assert response.status_code == 404

    def test_create_status_update_wrong_org_status_page(self):
        """Test creating a status update with status page from different org."""
        other_org = self.create_organization(owner=self.user)
        other_status_page = self.create_status_page(
            organization=other_org,
            title="Other Status Page",
        )

        data = {
            "title": "Test Update",
            "type": "operational",
        }

        response = self.get_error_response(
            self.organization.slug, other_status_page.id, method="post", status_code=404, **data
        )
        assert response.status_code == 404

    def test_create_status_update_invalid_parent(self):
        """Test creating a status update with invalid parent update."""
        data = {
            "title": "Test Update",
            "type": "operational",
            "parent_update": 99999,
        }

        response = self.get_error_response(
            self.organization.slug, self.status_page.id, method="post", status_code=404, **data
        )
        assert "Parent status update not found" in response.data["detail"]

    def test_create_status_update_wrong_org_parent(self):
        """Test creating a status update with parent from different org."""
        other_org = self.create_organization(owner=self.user)
        other_status_page = self.create_status_page(
            organization=other_org,
            title="Other Status Page",
        )
        other_parent = Factories.create_status_update(
            status_page=other_status_page,
            title="Other Parent",
        )

        data = {
            "title": "Test Update",
            "type": "operational",
            "parent_update": other_parent.id,
        }

        response = self.get_error_response(
            self.organization.slug, self.status_page.id, method="post", status_code=404, **data
        )
        assert "Parent status update not found" in response.data["detail"]

    def test_permission_denied(self):
        """Test that users without proper permissions cannot access the endpoint."""
        user = self.create_user()
        self.login_as(user)

        # Try to access organization they don't belong to
        response = self.get_error_response(
            self.organization.slug, self.status_page.id, status_code=403
        )
        assert response.status_code == 403

    def test_pagination(self):
        """Test that the endpoint supports pagination."""
        # Create multiple status updates
        for i in range(25):
            Factories.create_status_update(
                status_page=self.status_page,
                title=f"Status Update {i}",
            )

        response = self.get_success_response(
            self.organization.slug, self.status_page.id, qs_params={"per_page": "10"}
        )

        assert len(response.data) == 10
        assert "Link" in response.headers  # Pagination headers

    def test_ordering(self):
        """Test that status updates are ordered by start_time descending."""
        # Create status updates with different start times
        past_time = django_timezone.now() - django_timezone.timedelta(hours=1)
        future_time = django_timezone.now() + django_timezone.timedelta(hours=1)

        status_update_1 = Factories.create_status_update(
            status_page=self.status_page,
            title="Past Update",
            start_time=past_time,
        )
        status_update_2 = Factories.create_status_update(
            status_page=self.status_page,
            title="Future Update",
            start_time=future_time,
        )

        response = self.get_success_response(self.organization.slug, self.status_page.id)

        assert len(response.data) == 2
        assert response.data[0]["id"] == str(status_update_2.id)  # Future time first
        assert response.data[1]["id"] == str(status_update_1.id)  # Past time second
