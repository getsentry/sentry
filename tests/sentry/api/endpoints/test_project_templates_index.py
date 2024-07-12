from pytest import mark

from sentry.api.endpoints.project_templates_index import PROJECT_TEMPLATE_FEATURE_FLAG
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature


class ProjectTemplateIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-project-templates"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org, members=[self.user])

        self.login_as(self.user)

        self.project_template = self.create_project_template(organization=self.org)
        self.project_template_two = self.create_project_template(organization=self.org)

    def test_get__no_feature(self):
        response = self.get_error_response(self.org.id, status_code=404)
        assert response.status_code == 404

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get(self):
        response = self.get_success_response(self.org.id)
        assert len(response.data) == 2

        # Ensure the project templates are sorted by date_added
        assert response.data[0]["id"] == self.project_template.id
        assert response.data[1]["id"] == self.project_template_two.id

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get__no_templates(self):
        # Delete the project templates
        self.project_template.delete()
        self.project_template_two.delete()

        response = self.get_success_response(self.org.id)
        assert len(response.data) == 0

    @mark.skip("TODO Implement tests for pagination")
    def test_get__pagination(self):
        pass

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get__no_access(self):
        # Create a new organization and project templates
        org_two = self.create_organization()
        self.create_project_template(organization=org_two)
        self.create_project_template(organization=org_two)

        # Ensure this errors with 403, as the user does not have access to the organization
        response = self.get_error_response(org_two.id, status_code=403)
        assert response.status_code == 403
