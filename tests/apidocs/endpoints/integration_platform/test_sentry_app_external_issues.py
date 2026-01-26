from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppDocsTest(APIDocsTestCase):
    def setUp(self) -> None:
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)
        self.sentry_app = self.create_sentry_app(
            name="Hellboy App", published=True, organization=self.org
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug
        )
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-external-issues",
            kwargs={"uuid": self.install.uuid},
        )

        self.login_as(user=self.user)

    def test_post(self) -> None:
        data = {
            "issueId": self.group.id,
            "webUrl": "https://somerandom.io/project/issue-id",
            "project": "ExternalProj",
            "identifier": "issue-1",
        }
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
