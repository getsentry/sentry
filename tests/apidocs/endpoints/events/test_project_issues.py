from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectIssuesDocs(APIDocsTestCase):
    def setUp(self):
        self.create_event("a")
        self.create_event("b")

        self.url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/"

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self):
        data = {"isPublic": False, "status": "unresolved", "statusDetails": {}}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)

    def test_delete(self):
        response = self.client.delete(self.url)
        request = RequestFactory().delete(self.url)

        self.validate_schema(request, response)
