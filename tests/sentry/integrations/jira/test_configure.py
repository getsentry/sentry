from __future__ import absolute_import

from sentry.utils.compat.mock import patch
from jwt import ExpiredSignatureError

from django.core.urlresolvers import reverse

from sentry.integrations.atlassian_connect import AtlassianConnectValidationError
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri


PERMISSIONS_WARNING = b"You must be an organization owner or manager in Sentry to complete setup."
REFRESH_REQUIRED = b"This page has expired, please refresh to configure your Sentry integration"
LOGIN_REQUIRED = b"Please login to your Sentry account to access the Sentry Add-on configuration"
ORGANIZATIONS_FORM = b"Enabled Sentry Organizations"
COMPLETED = b"Saved!"


class JiraConfigureViewTestCase(APITestCase):
    def setUp(self):
        super(JiraConfigureViewTestCase, self).setUp()
        self.path = absolute_uri("extensions/jira/configure/") + "?xdm_e=base_url"
        org = self.organization

        self.user.name = "Sentry Admin"
        self.user.save()

        integration = Integration.objects.create(provider="jira", name="Example Jira")
        integration.add_organization(org, self.user)
        self.installation = integration.get_installation(org.id)


class JiraConfigureViewErrorsTest(JiraConfigureViewTestCase):
    @patch(
        "sentry.integrations.jira.configure.get_integration_from_request",
        side_effect=AtlassianConnectValidationError(),
    )
    def test_atlassian_connect_validation_error_get(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert PERMISSIONS_WARNING in response.content

    @patch(
        "sentry.integrations.jira.configure.get_integration_from_request",
        side_effect=ExpiredSignatureError(),
    )
    def test_expired_signature_error_get(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert REFRESH_REQUIRED in response.content

    @patch("sentry.integrations.jira.configure.get_integration_from_request")
    def test_user_not_logged_in_get(self, mock_get_integration_from_request):
        mock_get_integration_from_request.return_value = self.installation.model
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert LOGIN_REQUIRED in response.content
        assert absolute_uri(reverse("sentry-login")).encode("utf-8") in response.content

    @patch(
        "sentry.integrations.jira.configure.get_integration_from_request",
        side_effect=AtlassianConnectValidationError(),
    )
    def test_atlassian_connect_validation_error_post(self, mock_get_integration_from_request):
        response = self.client.post(self.path)
        assert response.status_code == 200
        assert PERMISSIONS_WARNING in response.content

    @patch(
        "sentry.integrations.jira.configure.get_integration_from_request",
        side_effect=ExpiredSignatureError(),
    )
    def test_expired_signature_error_post(self, mock_get_integration_from_request):
        response = self.client.post(self.path)
        assert response.status_code == 200
        assert REFRESH_REQUIRED in response.content

    @patch("sentry.integrations.jira.configure.get_integration_from_request")
    def test_user_not_logged_in_post(self, mock_get_integration_from_request):
        mock_get_integration_from_request.return_value = self.installation.model
        response = self.client.post(self.path)
        assert response.status_code == 200
        assert LOGIN_REQUIRED in response.content
        assert absolute_uri(reverse("sentry-login")).encode("utf-8") in response.content


class JiraConfigureViewTest(JiraConfigureViewTestCase):
    def setUp(self):
        super(JiraConfigureViewTest, self).setUp()
        self.login_as(self.user)

    def assert_no_errors(self, response):
        assert PERMISSIONS_WARNING not in response.content
        assert REFRESH_REQUIRED not in response.content
        assert LOGIN_REQUIRED not in response.content

    @patch("sentry.integrations.jira.configure.get_integration_from_request")
    def test_simple_get(self, mock_get_integration_from_request):
        mock_get_integration_from_request.return_value = self.installation.model
        response = self.client.get(self.path)
        assert response.status_code == 200
        self.assert_no_errors(response)
        assert ORGANIZATIONS_FORM in response.content

    @patch("sentry.integrations.jira.configure.get_integration_from_request")
    def test_simple_post(self, mock_get_integration_from_request):
        mock_get_integration_from_request.return_value = self.installation.model
        response = self.client.post(self.path, data={"organizations": [self.organization.id]})
        assert response.status_code == 200
        self.assert_no_errors(response)
        assert ORGANIZATIONS_FORM not in response.content
        assert COMPLETED in response.content
