from django.urls import NoReverseMatch, reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.compat.mock import patch


class EventIdLookupEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        min_ago = iso_format(before_now(minutes=1))
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        self.event = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        self.group = self.event.group
        self.login_as(user=self.user)

    def test_simple(self):
        url = reverse(
            "sentry-api-0-event-id-lookup",
            kwargs={"organization_slug": self.org.slug, "event_id": self.event.event_id},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["organizationSlug"] == self.org.slug
        assert response.data["projectSlug"] == self.project.slug
        assert response.data["groupId"] == str(self.group.id)
        assert response.data["eventId"] == str(self.event.event_id)
        assert response.data["event"]["id"] == str(self.event.event_id)

    def test_missing_eventid(self):
        url = reverse(
            "sentry-api-0-event-id-lookup",
            kwargs={"organization_slug": self.org.slug, "event_id": "c" * 32},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    @patch(
        "sentry.api.helpers.group_index.ratelimiter.is_limited",
        autospec=True,
        return_value=True,
    )
    def test_ratelimit(self, is_limited):
        url = reverse(
            "sentry-api-0-event-id-lookup",
            kwargs={"organization_slug": self.org.slug, "event_id": self.event.event_id},
        )
        resp = self.client.get(url, format="json")

        assert resp.status_code == 429

    def test_invalid_event_id(self):
        with self.assertRaises(NoReverseMatch):
            reverse(
                "sentry-api-0-event-id-lookup",
                kwargs={
                    "organization_slug": self.org.slug,
                    "event_id": "not-an-event",
                },
            )

        url = reverse(
            "sentry-api-0-event-id-lookup",
            kwargs={"organization_slug": self.org.slug, "event_id": 123456},
        )
        resp = self.client.get(url, format="json")

        assert resp.status_code == 400
