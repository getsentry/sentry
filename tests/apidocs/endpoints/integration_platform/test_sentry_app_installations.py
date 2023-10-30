from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation


class SentryAppInstallationDocs(APIDocsTestCase):
    def setUp(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Jessla", owner=None)
        self.create_member(user=self.user, organization=self.org, role="owner")

        self.sentry_app = self.create_sentry_app(
            name="Tesla App", published=True, organization=self.org
        )
        self.install = SentryAppInstallation(
            sentry_app=self.sentry_app, organization_id=self.org.id
        )
        self.install.save()

        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-sentry-app-installations",
            kwargs={"organization_slug": self.org.slug},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
