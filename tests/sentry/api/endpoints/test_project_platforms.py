from sentry.models.projectplatform import ProjectPlatform
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectPlatformsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        pp1 = ProjectPlatform.objects.create(project_id=project.id, platform="javascript")
        url = f"/api/0/projects/{project.organization.slug}/{project.slug}/platforms/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data[0]["platform"] == pp1.platform
