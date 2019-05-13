from __future__ import absolute_import

from sentry.testutils import APITestCase


class InternalQueueTasksListTest(APITestCase):
    def test_anonymous(self):
        self.login_as(self.user, superuser=True)
        url = "/api/0/internal/queue/tasks/"
        response = self.client.get(url)
        assert response.status_code == 200
        assert "sentry.tasks.send_beacon" in response.data
