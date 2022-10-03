import pytest
from django.urls import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class OrganizationEventsMetaEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.login_as(user=self.user)
        self.project_1 = self.create_project()
        self.project_2 = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-replay-events-meta",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.features = {"organizations:session-replay": True}

    def test_simple(self):
        event_id_a = "a" * 32
        event_id_b = "b" * 32

        event_a = self.store_event(
            data={"event_id": event_id_a, "timestamp": iso_format(self.min_ago)},
            project_id=self.project_1.id,
        )
        event_b = self.store_event(
            data={"event_id": event_id_b, "timestamp": iso_format(self.min_ago)},
            project_id=self.project_2.id,
        )
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project_1.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project_1.id)

        query = {"query": f"id:[{event_id_a}, {event_id_b}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = [
            {
                "error.type": [],
                "error.value": [],
                "id": event_id_a,
                "issue.id": 1,
                "issue": event_a.group.qualified_short_id,
                "project.name": self.project_1.slug,
                "timestamp": iso_format(self.min_ago) + "+00:00",
                "title": "<unlabeled event>",
            },
            {
                "error.type": [],
                "error.value": [],
                "id": event_id_b,
                "issue.id": 2,
                "issue": event_b.group.qualified_short_id,
                "project.name": self.project_2.slug,
                "timestamp": iso_format(self.min_ago) + "+00:00",
                "title": "<unlabeled event>",
            },
        ]

        assert response.status_code == 200, response.content
        assert response.data["data"] == expected
