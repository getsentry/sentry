from sentry import tsdb
from sentry.models import ProjectKey
from sentry.testutils import APITestCase


class ProjectKeyStatsTest(APITestCase):
    def setUp(self):
        self.project = self.create_project()
        self.key = ProjectKey.objects.create(project=self.project)
        self.login_as(user=self.user)
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/keys/{self.key.public_key}/stats/"

    def test_simple(self):
        tsdb.incr(tsdb.models.key_total_received, self.key.id, count=3)
        tsdb.incr(tsdb.models.key_total_blacklisted, self.key.id, count=1)

        response = self.client.get(self.path)
        assert response.status_code == 200

        assert response.status_code == 200, response.content
        assert response.data[-1]["total"] == 3, response.data
        assert response.data[-1]["filtered"] == 1, response.data
        for point in response.data[:-1]:
            assert point["total"] == 0
        assert len(response.data) == 24

    def test_invalid_parameters(self):
        url = self.path + "?resolution=1x"
        response = self.client.get(url)
        assert response.status_code == 400

    # This test can be removed once the TSDB metrics that were stored
    # under str(key_id) have expired out of redis.
    def test_str_key_id(self):
        tsdb.incr(tsdb.models.key_total_received, self.key.id, count=1)
        tsdb.incr(tsdb.models.key_total_received, str(self.key.id), count=1)

        response = self.client.get(self.path)
        assert response.status_code == 200

        assert response.status_code == 200, response.content
        assert response.data[-1]["total"] == 2, response.data
        for point in response.data[:-1]:
            assert point["total"] == 0
        assert len(response.data) == 24
