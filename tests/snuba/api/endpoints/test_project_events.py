from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.compat import map


class ProjectEventsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        event_1 = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )
        event_2 = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [event_1.event_id, event_2.event_id]
        )

    def test_message_search(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"message": "how to make fast", "timestamp": iso_format(before_now(minutes=1))},
            project_id=project.id,
        )
        event_2 = self.store_event(
            data={"message": "Delet the Data", "timestamp": iso_format(before_now(minutes=1))},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.get(url, {"query": "delet"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_2.event_id
        assert response.data[0]["message"] == "Delet the Data"

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(data={"timestamp": iso_format(before_now(days=2))}, project_id=project.id)
        event_2 = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )

        with self.options({"system.event-retention-days": 1}):
            url = reverse(
                "sentry-api-0-project-events",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                },
            )
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_2.event_id
