from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.utils import json
from sentry.testutils import APITestCase


class ProjectCreateSampleTest(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)
        self.team = self.create_team()

    def test_simple(self):
        project = self.create_project(teams=[self.team], name="foo")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_project_platform(self):
        project = self.create_project(teams=[self.team], name="foo", platform="javascript-react")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_cocoa(self):
        project = self.create_project(teams=[self.team], name="foo", platform="cocoa")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_java(self):
        project = self.create_project(teams=[self.team], name="foo", platform="java")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_javascript(self):
        project = self.create_project(teams=[self.team], name="foo", platform="javascript")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_php(self):
        project = self.create_project(teams=[self.team], name="foo", platform="php")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_python(self):
        project = self.create_project(teams=[self.team], name="foo", platform="python")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_reactnative(self):
        project = self.create_project(teams=[self.team], name="foo", platform="react-native")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)

    def test_ruby(self):
        project = self.create_project(teams=[self.team], name="foo", platform="ruby")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
        assert "groupID" in json.loads(response.content)
