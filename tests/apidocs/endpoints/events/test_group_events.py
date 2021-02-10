from django.test.client import RequestFactory

from sentry.testutils.helpers.datetime import iso_format, before_now
from tests.apidocs.util import APIDocsTestCase


class ProjectGroupEventBase(APIDocsTestCase):
    def setUp(self):
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

        self.group_id = event.group.id

        self.login_as(user=self.user)


class ProjectGroupEventsDocs(ProjectGroupEventBase):
    def setUp(self):
        super().setUp()
        self.url = f"/api/0/issues/{self.group_id}/events/"

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)


class ProjectGroupEventsLatestDocs(ProjectGroupEventBase):
    def setUp(self):
        super().setUp()
        self.url = f"/api/0/issues/{self.group_id}/events/latest/"

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)


class ProjectGroupEventsOldestDocs(ProjectGroupEventBase):
    def setUp(self):
        super().setUp()
        self.url = f"/api/0/issues/{self.group_id}/events/oldest/"

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
