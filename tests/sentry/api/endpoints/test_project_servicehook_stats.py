from __future__ import absolute_import

from sentry import tsdb
from sentry.models import ServiceHook
from sentry.testutils import APITestCase


class ProjectServiceHookStatsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        hook = ServiceHook.objects.get_or_create(
            project_id=project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.login_as(user=self.user)
        path = u"/api/0/projects/{}/{}/hooks/{}/stats/".format(
            project.organization.slug, project.slug, hook.guid
        )

        tsdb.incr(tsdb.models.servicehook_fired, hook.id, count=3)

        response = self.client.get(path)
        assert response.status_code == 200

        assert response.status_code == 200, response.content
        assert response.data[-1]["total"] == 3, response.data
        for point in response.data[:-1]:
            assert point["total"] == 0
        assert len(response.data) == 24
