from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase


class ProjectGroupHashesDocs(APIDocsTestCase):
    def setUp(self):
        self.create_event("a")
        event = self.create_event("b")

        self.url = f"/api/0/organizations/{self.organization.slug}/issues/{event.group_id}/hashes/"

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
