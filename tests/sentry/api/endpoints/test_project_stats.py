from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class ProjectStatsTest(APITestCase):
    def test_simple(self):
        # TODO: ensure this test checks data
        self.login_as(user=self.user)

        project = self.create_project(owner=self.user)

        url = reverse('sentry-api-0-project-stats', kwargs={
            'project_id': project.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
