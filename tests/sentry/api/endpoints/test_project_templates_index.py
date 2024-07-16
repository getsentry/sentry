from unittest.mock import patch

from pytest import mark

from sentry.api.endpoints.project_templates_index import PROJECT_TEMPLATE_FEATURE_FLAG
from sentry.models.projecttemplate import ProjectTemplate
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature


class ProjectTemplateAPIBase(APITestCase):
    endpoint = "sentry-api-0-organization-project-templates"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team()

        self.login_as(self.user)

        self.project_template = self.create_project_template(organization=self.organization)
        self.project_template_two = self.create_project_template(organization=self.organization)


class ProjectTemplateIndexTest(ProjectTemplateAPIBase):
    def test_get__no_feature(self):
        response = self.get_error_response(self.organization.id, status_code=404)
        assert response.status_code == 404

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get(self):
        response = self.get_success_response(self.organization.id)
        assert len(response.data) == 2

        # Ensure the project templates are sorted by date_added
        assert response.data[0]["id"] == self.project_template.id
        assert response.data[1]["id"] == self.project_template_two.id

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get__no_templates(self):
        # Delete the project templates
        self.project_template.delete()
        self.project_template_two.delete()

        response = self.get_success_response(self.organization.id)
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


class ProjectTemplateIndexPostTest(ProjectTemplateAPIBase):
    method = "POST"

    def test_post__no_feature(self):
        response = self.get_error_response(self.organization.id, status_code=404)
        assert response.status_code == 404

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_post(self):
        response = self.get_success_response(self.organization.id, name="Test Project Template")
        assert response.status_code == 201

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_post__as_member_without_permission(self):
        """
        Test that a member is part of the organization, but does not have the required
        permissions to create a project template.

        The user is a member of the organization, but does not have write access to the org.
        """
        org_two = self.create_organization()
        self.create_team(organization=org_two, members=[self.user])
        self.create_project_template(organization=org_two)

        response = self.get_error_response(org_two.id, status_code=403)
        assert response.status_code == 403

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_post__with_options(self):
        test_options = {"test-key": "value"}
        response = self.get_success_response(
            self.organization.id,
            name="Test Project Template",
            options=test_options,
        )

        assert response.status_code == 201
        new_template = ProjectTemplate.objects.get(id=response.data["id"])
        created_options = {opt.key: opt.value for opt in new_template.options.all()}
        assert created_options == test_options

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_post__no_name(self):
        response = self.get_error_response(self.organization.id, status_code=400)
        assert response.status_code == 400

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    @patch("sentry.api.base.create_audit_entry")
    def test_post__audit_log(self, mock_audit):
        self.get_success_response(
            self.organization.id,
            name="Test Project Template",
        )

        mock_audit.assert_called()
        mock_audit.reset_mock()
