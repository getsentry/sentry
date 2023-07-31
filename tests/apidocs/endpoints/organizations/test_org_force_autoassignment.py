from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class ForceAutoassignmentDocsTest(APIDocsTestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-organization-force-auto-assignment",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_put(self):
        group = self.create_group(project=self.project)
        data = {"groupIds": [group.id]}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)
