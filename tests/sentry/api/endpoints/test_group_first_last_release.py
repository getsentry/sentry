from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupFirstLastTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        group = self.create_group()
        url = f"/api/0/issues/{group.id}/first-last-release/"
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"] is None
        assert response.data["lastRelease"] is None

        event = self.store_event(data={"release": "1.0"}, project_id=self.project.id)
        group = event.group

        url = f"/api/0/issues/{group.id}/first-last-release/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.0"
        assert response.data["lastRelease"]["version"] == "1.0"
