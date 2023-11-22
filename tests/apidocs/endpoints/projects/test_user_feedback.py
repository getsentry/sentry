from django.test.client import RequestFactory
from django.utils import timezone

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectUserFeedbackDocs(APIDocsTestCase):
    def setUp(self):
        event = self.create_event("a", message="oh no")
        self.event_id = event.event_id
        self.create_userreport(
            date_added=timezone.now(),
            project=self.project,
            event_id=self.event_id,
        )

        self.url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/user-feedback/"

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):
        data = {
            "event_id": self.event_id,
            "name": "Hellboy",
            "email": "hellboy@sentry.io",
            "comments": "It broke!",
        }
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
