from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectFilterAddReleaseTest(APITestCase):
    endpoint = "sentry-api-0-project-filters-add-release"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_add_release_filter(self):
        project = self.create_project()
        release_version = "1.2.3"

        response = self.get_success_response(
            project.organization.slug,
            project.slug,
            release=release_version,
        )

        assert response.data["release"] == release_version
        assert response.data["detail"] == "Release filter added successfully"

        # Verify the filter was added to project options
        filters = project.get_option("filters:releases", default="")
        assert release_version in filters

    def test_add_multiple_releases(self):
        project = self.create_project()

        # Add first release
        self.get_success_response(
            project.organization.slug,
            project.slug,
            release="1.0.0",
        )

        # Add second release
        self.get_success_response(
            project.organization.slug,
            project.slug,
            release="2.0.0",
        )

        # Verify both releases are in the filter
        filters = project.get_option("filters:releases", default="")
        assert "1.0.0" in filters
        assert "2.0.0" in filters

    def test_add_duplicate_release(self):
        project = self.create_project()
        release_version = "1.2.3"

        # Add release first time
        self.get_success_response(
            project.organization.slug,
            project.slug,
            release=release_version,
        )

        # Add same release again
        self.get_success_response(
            project.organization.slug,
            project.slug,
            release=release_version,
        )

        # Verify release appears only once
        filters = project.get_option("filters:releases", default="")
        filter_list = [f.strip() for f in filters.split("\n") if f.strip()]
        assert filter_list.count(release_version) == 1

    def test_add_release_to_existing_filters(self):
        project = self.create_project()

        # Set existing filters
        project.update_option("filters:releases", "0.9.*\nold-release")

        # Add new release
        new_release = "1.2.3"
        self.get_success_response(
            project.organization.slug,
            project.slug,
            release=new_release,
        )

        # Verify all filters are present
        filters = project.get_option("filters:releases", default="")
        assert "0.9.*" in filters
        assert "old-release" in filters
        assert new_release in filters

    def test_missing_release_parameter(self):
        project = self.create_project()

        response = self.get_error_response(
            project.organization.slug,
            project.slug,
            status_code=400,
        )

        assert "release" in response.data

    def test_empty_release_parameter(self):
        project = self.create_project()

        response = self.get_error_response(
            project.organization.slug,
            project.slug,
            release="",
            status_code=400,
        )

        assert "release" in response.data

    def test_requires_authentication(self):
        project = self.create_project()

        self.get_error_response(
            project.organization.slug,
            project.slug,
            release="1.2.3",
            status_code=401,
        )

    def test_requires_project_access(self):
        other_user = self.create_user()
        self.login_as(user=other_user)
        project = self.create_project()

        self.get_error_response(
            project.organization.slug,
            project.slug,
            release="1.2.3",
            status_code=403,
        )
