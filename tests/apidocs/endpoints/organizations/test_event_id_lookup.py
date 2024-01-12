from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationEventIDLookupDocs(APIDocsTestCase):
    def setUp(self):
        event = self.create_event("a", message="oh no")
        self.url = reverse(
            "sentry-api-0-event-id-lookup",
            kwargs={"organization_slug": self.organization.slug, "event_id": event.event_id},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
