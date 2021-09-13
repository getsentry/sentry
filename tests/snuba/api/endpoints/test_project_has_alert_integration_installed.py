from sentry.models import Integration
from sentry.testutils import APITestCase, SnubaTestCase


class ProjectTagsTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-has-alert-integration-installed"

    def setUp(self):
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    def test_has_alert_integration(self):
        integration = Integration.objects.create(provider="msteams")
        integration.add_organization(self.organization)

        response = self.get_valid_response(self.organization.slug, self.project.slug)
        assert response.data["hasAlertIntegrationInstalled"]

    def test_no_alert_integration(self):
        response = self.get_valid_response(self.organization.slug, self.project.slug)
        assert not response.data["hasAlertIntegrationInstalled"]
