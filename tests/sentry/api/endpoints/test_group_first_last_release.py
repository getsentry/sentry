from sentry.testutils import APITestCase, SnubaTestCase


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
