from django.test.client import RequestFactory
from django.urls import reverse
from django.utils import timezone

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.silo import region_silo_test

# from sentry.models.eventuser import EventUser
from sentry.utils.eventuser import EventUser


@region_silo_test(stable=True)
class ProjectUsersDocs(APIDocsTestCase):
    def setUp(self):
        timestamp = iso_format(timezone.now())
        self.project = self.create_project()
        self.url = reverse(
            "sentry-api-0-project-users",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )

        self.event1 = self.store_event(
            project_id=self.project.id,
            data={
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foobar",
                    "ip_address": "127.0.0.1",
                },
                "event_id": "b" * 32,
                "timestamp": timestamp,
            },
        )
        self.euser1 = EventUser.from_event(self.event1)

        self.event2 = self.store_event(
            project_id=self.project.id,
            data={
                "user": {
                    "id": 2,
                    "email": "bar@example.com",
                    "username": "baz",
                    "ip_address": "192.168.0.1",
                },
                "event_id": "c" * 32,
                "timestamp": timestamp,
            },
        )
        self.euser2 = EventUser.from_event(self.event2)

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)
