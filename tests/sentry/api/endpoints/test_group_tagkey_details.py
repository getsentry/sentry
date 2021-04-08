from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupTagDetailsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        for i in range(3):
            self.store_event(
                data={
                    "tags": {"foo": "bar"},
                    "fingerprint": ["group1"],
                    "timestamp": iso_format(before_now(seconds=1)),
                },
                project_id=self.project.id,
            )

        group = Group.objects.first()

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/foo/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == "foo"
        assert response.data["totalValues"] == 3
