from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupEventsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)
        project = self.create_project()
        self.event_a = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "development",
                "timestamp": iso_format(before_now(days=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": iso_format(before_now(minutes=5)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.ids = [self.event_a.event_id, self.event_b.event_id, self.event_c.event_id]

    def test_get_simple(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert sorted(map(lambda e: e["id"], response.data)) == self.ids

    def test_get_with_environment(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == self.event_b.event_id

    def test_collapse_event_only(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/"
        response = self.client.get(url, format="json", data={"collapse": ["stacktraceOnly"]})

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert sorted(map(lambda e: e["id"], response.data)) == self.ids
