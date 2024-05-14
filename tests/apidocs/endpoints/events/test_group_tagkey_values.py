from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase


class GroupTagKeyValuesDocs(APIDocsTestCase):
    def setUp(self):
        key, value = "foo", "bar"
        event = self.create_event("a", tags={key: value})

        self.login_as(user=self.user)

        self.url = f"/api/0/organizations/{self.organization.slug}/issues/{event.group_id}/tags/{key}/values/"

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
