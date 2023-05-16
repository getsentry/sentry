from rest_framework.exceptions import ErrorDetail

from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectStacktraceLinksTest(APITestCase):
    endpoint = "sentry-api-0-project-stacktrace-links"
    filepath = "sentry/search/events/datasets/discover.py"

    def setUp(self):
        self.login_as(self.user)

    def test_no_files(self):
        """The file query search is missing"""
        response = self.get_error_response(
            self.organization.slug, self.project.slug, status_code=400
        )
        assert response.data == {
            "file": [ErrorDetail(string="This field is required.", code="required")]
        }

    def test_no_configs(self):
        """No code mappings have been set for this project"""
        # new project that has no configurations set up for it
        project = self.create_project(
            name="foo",
            organization=self.organization,
            teams=[self.create_team(organization=self.organization)],
        )

        response = self.get_success_response(
            self.organization.slug, project.slug, qs_params={"file": self.filepath}
        )
        assert response.data == {
            "files": [
                {
                    "file": self.filepath,
                    "sourceUrl": None,
                },
            ],
        }
