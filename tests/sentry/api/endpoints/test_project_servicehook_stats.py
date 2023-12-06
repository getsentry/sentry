from sentry import tsdb
from sentry.models.servicehook import ServiceHook
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.tsdb.base import TSDBModel


@region_silo_test
class ProjectServiceHookStatsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        hook = ServiceHook.objects.get_or_create(
            project_id=project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.login_as(user=self.user)
        path = (
            f"/api/0/projects/{project.organization.slug}/{project.slug}/hooks/{hook.guid}/stats/"
        )

        tsdb.backend.incr(TSDBModel.servicehook_fired, hook.id, count=3)

        response = self.client.get(path)
        assert response.status_code == 200

        assert response.status_code == 200, response.content
        assert response.data[-1]["total"] == 3, response.data
        for point in response.data[:-1]:
            assert point["total"] == 0
        assert len(response.data) == 24
