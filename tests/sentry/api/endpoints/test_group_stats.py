from __future__ import absolute_import

from sentry.testutils import APITestCase, SnubaTestCase


class GroupStatsTest(APITestCase, SnubaTestCase):
    def create_event(self):
        return self.store_event(data={"fingerprint": ["group_i1"]}, project_id=self.project.id)

    def test_simple(self):
        self.login_as(user=self.user)

        event = self.create_event()
        group = event.group

        url = u"/api/0/issues/{}/stats/".format(group.id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 1
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24

        for i in range(3):
            self.create_event()

        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 4, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
