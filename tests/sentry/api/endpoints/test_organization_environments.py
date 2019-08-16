from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.models import Environment
from sentry.testutils import APITestCase


class OrganizationEnvironmentsTest(APITestCase):
    endpoint = "sentry-api-0-organization-environments"

    def setUp(self):
        self.login_as(user=self.user)

    @fixture
    def project(self):
        return self.create_project()

    def test_simple(self):
        Environment.objects.create(organization_id=self.project.organization_id, name="not project")
        prod = self.create_environment(name="production", project=self.project)
        staging = self.create_environment(name="staging", project=self.project)

        response = self.get_valid_response(self.project.organization.slug)
        assert response.data == serialize([prod, staging])

    def test_visibility(self):
        visible = self.create_environment(name="visible", project=self.project, is_hidden=False)
        hidden = self.create_environment(name="not visible", project=self.project, is_hidden=True)
        not_set = self.create_environment(name="null visible", project=self.project)
        response = self.get_valid_response(self.project.organization.slug, visibility="visible")
        assert response.data == serialize([not_set, visible])
        response = self.get_valid_response(self.project.organization.slug, visibility="hidden")
        assert response.data == serialize([hidden])
        response = self.get_valid_response(self.project.organization.slug, visibility="all")
        assert response.data == serialize([hidden, not_set, visible])

    def test_project_filter(self):
        other_project = self.create_project()
        project_env = self.create_environment(name="project", project=self.project)
        other_project_env = self.create_environment(name="other", project=other_project)

        response = self.get_valid_response(
            self.project.organization.slug, project=[self.project.id]
        )
        assert response.data == serialize([project_env])
        response = self.get_valid_response(
            self.project.organization.slug, project=[other_project.id]
        )
        assert response.data == serialize([other_project_env])
        response = self.get_valid_response(
            self.project.organization.slug, project=[self.project.id, other_project.id]
        )
        assert response.data == serialize([other_project_env, project_env])

    def test_invalid_visibility(self):
        response = self.get_response(self.project.organization.slug, visibility="invalid-vis")
        assert response.status_code == 400
        assert response.data["detail"].startswith("Invalid value for 'visibility'")
