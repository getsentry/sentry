from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class EventReprocessableEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        min_ago = before_now(minutes=1).isoformat()
        event1 = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )

        path = f"/api/0/projects/{event1.project.organization.slug}/{event1.project.slug}/events/{event1.event_id}/reprocessable/"
        response = self.client.get(path, format="json")
        assert response.status_code == 200
        assert not response.data["reprocessable"]
        assert response.data["reason"] == "unprocessed_event.not_found"
