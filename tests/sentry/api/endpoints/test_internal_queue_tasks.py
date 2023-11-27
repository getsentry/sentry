from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class InternalQueueTasksListTest(APITestCase):
    def test_anonymous(self):
        self.login_as(self.user, superuser=True)
        url = "/api/0/internal/queue/tasks/"
        response = self.client.get(url)
        assert response.status_code == 200
        assert "sentry.tasks.send_beacon" in response.data
