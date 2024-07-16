import pytest
from rest_framework.exceptions import ErrorDetail

from sentry.api.endpoints.project_templates_index import PROJECT_TEMPLATE_FEATURE_FLAG
from sentry.models.options.project_template_option import ProjectTemplateOption
from sentry.models.projecttemplate import ProjectTemplate
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature


class ProjectTemplateDetailTest(APITestCase):
    endpoint = "sentry-api-0-organization-project-template-detail"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org, members=[self.user])

        self.login_as(self.user)
        self.project_template = self.create_project_template(organization=self.org)

    def test_get__no_feature(self):
        response = self.get_error_response(self.org.id, self.project_template.id, status_code=404)
        assert response.status_code == 404

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get(self):
        self.project_template.options.create(
            project_template=self.project_template, key="sentry:release_track", value="test"
        )
        response = self.get_success_response(self.org.id, self.project_template.id)

        assert response.data["name"] == self.project_template.name
        assert response.data["options"] == {"sentry:release_track": "test"}

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get__not_found(self):
        response = self.get_error_response(self.org.id, 100, status_code=404)
        assert response.status_code == 404
        assert response.data == {
            "detail": ErrorDetail(
                string="No ProjectTemplate matches the given query.", code="not_found"
            )
        }

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get__wrong_id(self):
        org_two = self.create_organization()
        project_template = self.create_project_template(organization=org_two)

        response = self.get_error_response(self.org.id, project_template.id, status_code=404)
        assert response.status_code == 404
        assert response.data == {
            "detail": ErrorDetail(
                string="No ProjectTemplate matches the given query.", code="not_found"
            )
        }

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_get__no_access(self):
        # Create a new organization and project template
        org_two = self.create_organization()
        project_template = self.create_project_template(organization=org_two)

        # Ensure this errors with 403, as the user does not have access to the organization
        response = self.get_error_response(org_two.id, project_template.id, status_code=403)
        assert response.status_code == 403


class ProjectTemplateDetailDeleteTest(APITestCase):
    endpoint = "sentry-api-0-organization-project-template-detail"
    method = "delete"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team()

        self.login_as(self.user)
        self.project_template = self.create_project_template(organization=self.organization)

    def test_delete__no_feature(self):
        response = self.get_error_response(
            self.organization.id, self.project_template.id, status_code=404
        )
        assert response.status_code == 404

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_delete(self):
        template_id = self.project_template.id
        response = self.get_success_response(self.organization.id, template_id, status_code=204)
        assert response.status_code == 204

        with pytest.raises(ProjectTemplate.DoesNotExist):
            ProjectTemplate.objects.get(id=template_id)

    @with_feature(PROJECT_TEMPLATE_FEATURE_FLAG)
    def test_delete__with_options(self):
        template_id = self.project_template.id
        self.project_template.options.create(
            project_template=self.project_template, key="sentry:release_track", value="test"
        )
        self.project_template.options.create(
            project_template=self.project_template, key="sentry:another_example", value="test"
        )

        # Ensure the options are created
        assert ProjectTemplateOption.objects.filter(project_template_id=template_id).count() == 2

        response = self.get_success_response(self.organization.id, template_id, status_code=204)
        assert response.status_code == 204

        # Ensure data is deleted
        with pytest.raises(ProjectTemplate.DoesNotExist):
            ProjectTemplate.objects.get(id=template_id)
        assert ProjectTemplateOption.objects.filter(project_template_id=template_id).count() == 0
