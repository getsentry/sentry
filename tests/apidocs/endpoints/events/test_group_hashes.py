from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectGroupHashesDocs(APIDocsTestCase):
    def setUp(self):
        self.create_event("a")
        event = self.create_event("b")

        self.url = f"/api/0/issues/{event.group_id}/hashes/"

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
