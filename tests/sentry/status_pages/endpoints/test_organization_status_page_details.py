import pytest

from sentry.status_pages.models.status_page import StatusPage
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationStatusPageDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-status-page-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.status_page = self.create_status_page(
            organization=self.organization,
            title="Test Status Page",
            description="A test status page",
            is_public=False,
            is_accepting_subscribers=True,
        )

    def test_get_status_page(self):
        """Test fetching a single status page."""
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
        )
        assert response.data["id"] == str(self.status_page.id)
        assert response.data["title"] == "Test Status Page"
        assert response.data["description"] == "A test status page"
        assert response.data["isPublic"] is False
        assert response.data["isAcceptingSubscribers"] is True

    def test_get_status_page_not_found(self):
        """Test fetching a non-existent status page."""
        self.get_error_response(
            self.organization.slug,
            99999,
            status_code=404,
        )

    def test_get_status_page_wrong_org(self):
        """Test fetching a status page from a different organization."""
        other_org = self.create_organization()
        other_status_page = self.create_status_page(
            organization=other_org,
            title="Other Status Page",
        )
        self.get_error_response(
            self.organization.slug,
            other_status_page.id,
            status_code=404,
        )

    def test_update_status_page_minimal(self):
        """Test updating a status page with minimal fields."""
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            method="put",
            title="Updated Status Page",
        )
        assert response.data["title"] == "Updated Status Page"
        assert response.data["description"] == "A test status page"  # unchanged

        # Verify database was updated
        self.status_page.refresh_from_db()
        assert self.status_page.title == "Updated Status Page"

    def test_update_status_page_full(self):
        """Test updating a status page with all fields."""
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            method="put",
            title="Updated Status Page",
            description="Updated description",
            is_public=True,
            is_accepting_subscribers=False,
            cname="status.example.com",
        )
        assert response.data["title"] == "Updated Status Page"
        assert response.data["description"] == "Updated description"
        assert response.data["isPublic"] is True
        assert response.data["isAcceptingSubscribers"] is False
        assert response.data["cname"] == "status.example.com"

    def test_update_status_page_id_ignored(self):
        """Test that ID cannot be updated in PUT request."""
        original_id = self.status_page.id
        response = self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            method="put",
            title="Updated Status Page",
            id=99999,  # This should be ignored
        )
        assert response.data["id"] == str(original_id)  # ID should remain unchanged

        # Verify database ID was not changed
        self.status_page.refresh_from_db()
        assert self.status_page.id == original_id

    def test_update_status_page_missing_required_fields(self):
        """Test updating a status page with missing required fields."""
        response = self.get_error_response(
            self.organization.slug,
            self.status_page.id,
            method="put",
            title="",  # Empty title should fail
            status_code=400,
        )
        assert "title" in response.data

    def test_update_status_page_invalid_data(self):
        """Test updating a status page with invalid data."""
        response = self.get_error_response(
            self.organization.slug,
            self.status_page.id,
            method="put",
            title="x" * 65,  # Title too long
            status_code=400,
        )
        assert "title" in response.data

    def test_update_status_page_not_found(self):
        """Test updating a non-existent status page."""
        self.get_error_response(
            self.organization.slug,
            99999,
            method="put",
            title="Updated Title",
            status_code=404,
        )

    def test_delete_status_page(self):
        """Test deleting a status page."""
        self.get_success_response(
            self.organization.slug,
            self.status_page.id,
            method="delete",
            status_code=204,
        )

        # Verify status page is marked for deletion
        with pytest.raises(StatusPage.DoesNotExist):
            self.status_page.refresh_from_db()

    def test_delete_status_page_not_found(self):
        """Test deleting a non-existent status page."""
        self.get_error_response(
            self.organization.slug,
            99999,
            method="delete",
            status_code=404,
        )

    def test_delete_status_page_wrong_org(self):
        """Test deleting a status page from a different organization."""
        other_org = self.create_organization()
        other_status_page = self.create_status_page(
            organization=other_org,
            title="Other Status Page",
        )
        self.get_error_response(
            self.organization.slug,
            other_status_page.id,
            method="delete",
            status_code=404,
        )
