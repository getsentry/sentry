from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectGroupIssueDetailsDocs(APIDocsTestCase):
    def setUp(self):
        self.create_release(project=self.project, version="abcdabc")

        first_release = {
            "firstEvent": before_now(minutes=3),
            "lastEvent": before_now(minutes=2, seconds=30),
        }
        last_release = {
            "firstEvent": before_now(minutes=1, seconds=30),
            "lastEvent": before_now(minutes=1),
        }

        for timestamp in first_release.values():
            self.create_event("a", release="1.0", timestamp=iso_format(timestamp))
        self.create_event("b", release="1.1")

        for timestamp in last_release.values():
            event = self.create_event("c", release="1.0a", timestamp=iso_format(timestamp))

        self.url = f"/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/"

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self):
        data = {"status": "resolved"}

        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)

    def test_delete(self):
        response = self.client.delete(self.url)
        request = RequestFactory().delete(self.url)

        self.validate_schema(request, response)
