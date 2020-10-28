from __future__ import absolute_import

from sentry.models import ProjectPlatform
from sentry.testutils import APITestCase


class ProjectPlatformsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        pp1 = ProjectPlatform.objects.create(project_id=project.id, platform="javascript")
        url = u"/api/0/projects/{}/{}/platforms/".format(project.organization.slug, project.slug)
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data[0]["platform"] == pp1.platform
