from sentry.status_pages.models.status_page import StatusPage
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationStatusPagesTest(APITestCase):
    endpoint = "sentry-api-0-organization-status-pages"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_list_status_pages(self):
        """Test listing status pages for an organization."""
        # Create some status pages
        status_page_1 = self.create_status_page(
            organization=self.organization,
            title="Main Status Page",
            description="Our main status page",
            is_public=True,
            is_accepting_subscribers=True,
        )
        status_page_2 = self.create_status_page(
            organization=self.organization,
            title="Secondary Status Page",
            description="Secondary status page",
            is_public=False,
            is_accepting_subscribers=False,
        )

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert response.data[0]["id"] == str(status_page_2.id)  # Most recent first
        assert response.data[0]["title"] == "Secondary Status Page"
        assert response.data[0]["description"] == "Secondary status page"
        assert response.data[0]["isPublic"] is False
        assert response.data[0]["isAcceptingSubscribers"] is False
        assert response.data[0]["organizationId"] == str(self.organization.id)

        assert response.data[1]["id"] == str(status_page_1.id)
        assert response.data[1]["title"] == "Main Status Page"
        assert response.data[1]["description"] == "Our main status page"
        assert response.data[1]["isPublic"] is True
        assert response.data[1]["isAcceptingSubscribers"] is True

    def test_list_empty_status_pages(self):
        """Test listing when no status pages exist."""
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 0

    def test_list_status_pages_other_org(self):
        """Test that status pages from other organizations are not returned."""
        other_org = self.create_organization(owner=self.user)
        self.create_status_page(
            organization=other_org,
            title="Other Org Status Page",
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 0

    def test_create_status_page_minimal(self):
        """Test creating a status page with minimal data."""
        data = {"title": "New Status Page"}

        response = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **data
        )

        assert response.data["title"] == "New Status Page"
        assert response.data["description"] is None
        assert response.data["isPublic"] is False
        assert response.data["isAcceptingSubscribers"] is False
        assert response.data["cname"] is None
        assert response.data["organizationId"] == str(self.organization.id)

        # Verify it was created in the database
        status_page = StatusPage.objects.get(id=response.data["id"])
        assert status_page.title == "New Status Page"
        assert status_page.organization == self.organization

    def test_create_status_page_full(self):
        """Test creating a status page with all fields."""
        data = {
            "title": "Full Status Page",
            "description": "A comprehensive status page",
            "is_public": True,
            "is_accepting_subscribers": True,
            "cname": "status.example.com",
        }

        response = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **data
        )

        assert response.data["title"] == "Full Status Page"
        assert response.data["description"] == "A comprehensive status page"
        assert response.data["isPublic"] is True
        assert response.data["isAcceptingSubscribers"] is True
        assert response.data["cname"] == "status.example.com"

        # Verify it was created in the database
        from sentry.status_pages.models.status_page import StatusPage

        status_page = StatusPage.objects.get(id=response.data["id"])
        assert status_page.title == "Full Status Page"
        assert status_page.description == "A comprehensive status page"
        assert status_page.is_public is True
        assert status_page.is_accepting_subscribers is True
        assert status_page.cname == "status.example.com"

    def test_create_status_page_missing_title(self):
        """Test creating a status page without required title."""
        response = self.get_error_response(self.organization.slug, method="post", status_code=400)
        assert "title" in response.data

    def test_create_status_page_title_too_long(self):
        """Test creating a status page with title exceeding max length."""
        data = {"title": "A" * 65}  # Max length is 64

        response = self.get_error_response(
            self.organization.slug, method="post", status_code=400, **data
        )
        assert "title" in response.data

    def test_create_status_page_cname_too_long(self):
        """Test creating a status page with cname exceeding max length."""
        data = {
            "title": "Valid Title",
            "cname": "A" * 256,  # Max length is 255
        }

        response = self.get_error_response(
            self.organization.slug, method="post", status_code=400, **data
        )
        assert "cname" in response.data

    def test_create_status_page_empty_strings(self):
        """Test creating a status page with empty strings for optional fields."""
        data = {
            "title": "Valid Title",
            "description": "",
            "cname": "",
        }

        response = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **data
        )

        assert response.data["title"] == "Valid Title"
        assert response.data["description"] == ""
        assert response.data["cname"] == ""

    def test_permission_denied(self):
        """Test that users without proper permissions cannot access the endpoint."""
        user = self.create_user()
        self.login_as(user)

        # Try to access organization they don't belong to
        response = self.get_error_response(self.organization.slug, status_code=403)
        assert response.status_code == 403

    def test_pagination(self):
        """Test that the endpoint supports pagination."""
        # Create multiple status pages
        for i in range(25):
            self.create_status_page(
                organization=self.organization,
                title=f"Status Page {i}",
            )

        response = self.get_success_response(self.organization.slug, qs_params={"per_page": "10"})

        assert len(response.data) == 10
        assert "Link" in response.headers  # Pagination headers

    def test_ordering(self):
        """Test that status pages are ordered by date_added descending."""
        status_page_1 = self.create_status_page(
            organization=self.organization,
            title="First Status Page",
        )
        status_page_2 = self.create_status_page(
            organization=self.organization,
            title="Second Status Page",
        )

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert response.data[0]["id"] == str(status_page_2.id)  # Most recent first
        assert response.data[1]["id"] == str(status_page_1.id)
