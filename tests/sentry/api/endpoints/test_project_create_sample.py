from django.urls import reverse

from sentry.models.groupinbox import GroupInbox
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


@region_silo_test
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
        assert GroupInbox.objects.filter(group=response.data["groupID"]).exists()

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

    def test_attempted_path_traversal_returns_400(self):
        project = self.create_project(teams=[self.team], name="foo", platform="../../../etc/passwd")

        url = reverse(
            "sentry-api-0-project-create-sample",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(url, format="json")
        assert response.status_code == 400
