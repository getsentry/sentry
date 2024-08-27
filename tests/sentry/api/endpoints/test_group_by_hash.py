from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupByHashTest(APITestCase, SnubaTestCase):
    def test_finds_group_by_hash(self):
        self.login_as(user=self.user)

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            event_type=EventType.ERROR,
        )

        path = reverse(
            "sentry-api-0-project-group-by-hash",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "project_id_or_slug": self.project.slug,
                "hash": event.get_primary_hash(),
            },
        )
        response = self.client.get(path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
