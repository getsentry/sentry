from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class ProjectEventDetailsDocs(APIDocsTestCase):
    endpoint = "sentry-api-0-project-event-details"

    def setUp(self) -> None:
        self.create_event("a")
        event = self.create_event("b")
        self.create_event("c")

        self.create_event("d", fingerprint=["group-2"])

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        self.login_as(user=self.user)

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_get_collapse_adjacent_events(self) -> None:
        response = self.client.get(self.url, {"collapse": "adjacentEvents"})
        request = RequestFactory().get(self.url, {"collapse": "adjacentEvents"})

        assert response.data["nextEventID"] is None
        assert response.data["previousEventID"] is None
        self.validate_schema(request, response)
