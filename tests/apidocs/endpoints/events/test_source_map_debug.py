from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class SourceMapDebugDocs(APIDocsTestCase):
    endpoint = "sentry-api-0-event-source-map-debug"

    def setUp(self) -> None:
        event = self.create_event("a")

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
