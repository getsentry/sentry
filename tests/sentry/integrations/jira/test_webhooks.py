from __future__ import annotations

from unittest.mock import MagicMock, patch

import responses
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.response import Response

from fixtures.integrations.stub_service import StubService
from sentry.integrations.jira.webhooks.base import JiraTokenError, JiraWebhookBase
from sentry.integrations.mixins.issues import IssueSyncIntegration
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.utils.atlassian_connect import AtlassianConnectValidationError
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import APITestCase, TestCase

TOKEN = "JWT anexampletoken"


class JiraIssueUpdatedWebhookTest(APITestCase):
    endpoint = "sentry-extensions-jira-issue-updated"
    method = "post"

    def setUp(self):
        super().setUp()
        integration, _ = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        # Ensure this is region safe, and doesn't require the ORM integration model
        self.integration = serialize_integration(integration=integration)

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_simple_assign(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_sync_group_assignee_inbound.assert_called_with(
                self.integration, "jess@sentry.io", "APP-123", assign=True
            )

    @override_settings(JIRA_USE_EMAIL_SCOPE=True)
    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    @responses.activate
    def test_assign_use_email_api(self, mock_sync_group_assignee_inbound):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/3/user/email",
            json={"accountId": "deadbeef123", "email": self.user.email},
        )

        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            data["issue"]["fields"]["assignee"]["emailAddress"] = ""
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            assert mock_sync_group_assignee_inbound.called
            assert len(responses.calls) == 1

    @override_settings(JIRA_USE_EMAIL_SCOPE=True)
    @responses.activate
    def test_assign_use_email_api_error(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/3/user/email",
            status=500,
        )

        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            data["issue"]["fields"]["assignee"]["emailAddress"] = ""
            response = self.get_success_response(
                **data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN)
            )
            assert "error_message" in response.data

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_assign_missing_email(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            data["issue"]["fields"]["assignee"]["emailAddress"] = ""
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            assert not mock_sync_group_assignee_inbound.called

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_simple_deassign(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_no_assignee_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_sync_group_assignee_inbound.assert_called_with(
                self.integration, None, "APP-123", assign=False
            )

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_simple_deassign_assignee_missing(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_missing_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_sync_group_assignee_inbound.assert_called_with(
                self.integration, None, "APP-123", assign=False
            )

    @patch.object(IssueSyncIntegration, "sync_status_inbound")
    def test_simple_status_sync_inbound(self, mock_sync_status_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ) as mock_get_integration_from_jwt:
            data = StubService.get_stub_data("jira", "edit_issue_status_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_get_integration_from_jwt.assert_called_with(
                token="anexampletoken",
                path="/extensions/jira/issue-updated/",
                provider="jira",
                query_params={},
                method="POST",
            )
            mock_sync_status_inbound.assert_called_with(
                "APP-123",
                {
                    "changelog": {
                        "from": "10101",
                        "field": "status",
                        "fromString": "Done",
                        "to": "3",
                        "toString": "In Progress",
                        "fieldtype": "jira",
                        "fieldId": "status",
                    },
                    "issue": {
                        "fields": {"project": {"id": "10000", "key": "APP"}},
                        "key": "APP-123",
                    },
                },
            )

    @patch("sentry_sdk.set_tag")
    @patch("sentry.integrations.utils.scope.bind_organization_context")
    def test_adds_context_data(self, mock_bind_org_context: MagicMock, mock_set_tag: MagicMock):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))

            mock_set_tag.assert_any_call("integration_id", self.integration.id)
            mock_bind_org_context.assert_called_with(serialize_rpc_organization(self.organization))

    def test_missing_changelog(self):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "changelog_missing.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))


class MockErroringJiraEndpoint(JiraWebhookBase):
    permission_classes = ()
    dummy_exception = Exception("whoops")
    # In order to be able to use `as_view`'s `initkwargs` (in other words, in order to be able to
    # pass kwargs to `as_view` and have `as_view` pass them onto the `__init__` method below), any
    # kwarg we'd like to pass must already be an attibute of the class
    error = BaseException("unreachable")

    def __init__(self, error: Exception = dummy_exception, *args, **kwargs):
        # We allow the error to be passed in so that we have access to it in the test for use
        # in equality checks
        self.error = error
        super().__init__(*args, **kwargs)

    def get(self, request):
        raise self.error


class JiraWebhookBaseTest(TestCase):
    @patch("sentry.utils.sdk.capture_exception")
    def test_bad_request_errors(self, mock_capture_exception: MagicMock):
        for error_type in [AtlassianConnectValidationError, JiraTokenError]:
            mock_endpoint = MockErroringJiraEndpoint.as_view(error=error_type())

            request = self.make_request(method="GET")
            response = mock_endpoint(request)

            assert response.status_code == status.HTTP_409_CONFLICT
            # This kind of error shouldn't be sent to Sentry
            assert mock_capture_exception.call_count == 0

    @patch("sentry.integrations.jira.webhooks.base.logger")
    @patch("sentry.utils.sdk.capture_exception")
    def test_atlassian_pen_testing_bot(
        self, mock_capture_exception: MagicMock, mock_logger: MagicMock
    ):
        mock_endpoint = MockErroringJiraEndpoint.as_view(error=MethodNotAllowed("GET"))

        request = self.make_request(method="GET")
        request.META["HTTP_USER_AGENT"] = (
            "CSRT (github.com/atlassian-labs/connect-security-req-tester)"
        )
        response = mock_endpoint(request)

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        assert (
            mock_logger.info.call_args.args[0]
            == "Atlassian Connect Security Request Tester tried disallowed method"
        )
        # This kind of error shouldn't be sent to Sentry
        assert mock_capture_exception.call_count == 0

    @patch("sentry.api.base.Endpoint.handle_exception_with_details", return_value=Response())
    def test_APIError_host_and_path_added_as_tags(self, mock_super_handle_exception: MagicMock):
        handler_error = ApiError("", url="http://maiseycharlie.jira.com/rest/api/3/dogs/tricks")
        mock_endpoint = MockErroringJiraEndpoint.as_view(error=handler_error)

        request = self.make_request(method="GET")
        mock_endpoint(request)

        # signature is super().handle_exception_with_details(request, error, handler_context, scope)
        assert (
            mock_super_handle_exception.call_args.args[3]._tags["jira.host"]
            == "maiseycharlie.jira.com"
        )
        assert (
            mock_super_handle_exception.call_args.args[3]._tags["jira.endpoint"]
            == "/rest/api/3/dogs/tricks"
        )

    @patch("sentry.api.base.Endpoint.handle_exception_with_details", return_value=Response())
    def test_handles_xml_as_error_message(self, mock_super_handle_exception: MagicMock):
        """Moves the XML to `handler_context` and replaces it with a human-friendly message"""
        xml_string = '<?xml version="1.0"?><status><code>500</code><message>PSQLException: too many connections</message></status>'

        handler_error = ApiError(
            xml_string, url="http://maiseycharlie.jira.com/rest/api/3/dogs/tricks"
        )
        mock_endpoint = MockErroringJiraEndpoint.as_view(error=handler_error)

        request = self.make_request(method="GET")
        mock_endpoint(request)

        # signature is super().handle_exception_with_details(request, error, handler_context, scope)
        assert mock_super_handle_exception.call_args.args[1] == handler_error
        assert str(handler_error) == "Unknown error when requesting /rest/api/3/dogs/tricks"
        assert mock_super_handle_exception.call_args.args[2]["xml_response"] == xml_string

    @patch("sentry.api.base.Endpoint.handle_exception_with_details", return_value=Response())
    def test_handles_html_as_error_message(self, mock_super_handle_exception: MagicMock):
        """Moves the HTML to `handler_context` and replaces it with a human-friendly message"""
        html_strings = [
            # These aren't valid HTML (because they're cut off) but the `ApiError` constructor does
            # that, too, if the error text is long enough (though after more characters than this)
            '<!DOCTYPE html><html><head><title>Oops</title></head><body><div id="page"><div'
            '<html lang="en"><head><title>Oops</title></head><body><div id="page"><div'
        ]

        for html_string in html_strings:
            handler_error = ApiError(
                html_string, url="http://maiseycharlie.jira.com/rest/api/3/dogs/tricks"
            )
            mock_endpoint = MockErroringJiraEndpoint.as_view(error=handler_error)

            request = self.make_request(method="GET")
            mock_endpoint(request)

            # signature is super().handle_exception_with_details(request, error, handler_context, scope)
            assert mock_super_handle_exception.call_args.args[1] == handler_error
            assert str(handler_error) == "Unknown error when requesting /rest/api/3/dogs/tricks"
            assert mock_super_handle_exception.call_args.args[2]["html_response"] == html_string

    @patch("sentry.api.base.Endpoint.handle_exception_with_details", return_value=Response())
    def test_replacement_error_messages(self, mock_super_handle_exception: MagicMock):
        replacement_messages_by_code = {
            429: "Rate limit hit when requesting /rest/api/3/dogs/tricks",
            401: "Unauthorized request to /rest/api/3/dogs/tricks",
            502: "Bad gateway when connecting to /rest/api/3/dogs/tricks",
            504: "Gateway timeout when connecting to /rest/api/3/dogs/tricks",
        }

        for code, new_message in replacement_messages_by_code.items():
            handler_error = ApiError(
                "<!DOCTYPE html><html>Some HTML here</html>",
                url="http://maiseycharlie.jira.com/rest/api/3/dogs/tricks",
                code=code,
            )
            mock_endpoint = MockErroringJiraEndpoint.as_view(error=handler_error)

            request = self.make_request(method="GET")
            mock_endpoint(request)

            # signature is super().handle_exception_with_details(request, error, handler_context, scope)
            assert mock_super_handle_exception.call_args.args[1] == handler_error
            assert str(handler_error) == new_message

    @patch("sentry.integrations.jira.webhooks.base.logger")
    @patch("sentry.api.base.Endpoint.handle_exception_with_details", return_value=Response())
    def test_unexpected_jira_errors(
        self, mock_super_handle_exception: MagicMock, mock_logger: MagicMock
    ):
        unknown_errors = [
            (
                Exception(
                    "not a known error",
                ),
                "not a known error",
            ),
            (
                ApiError(
                    "<!DOCTYPE html><html>Some HTML here</html>",
                    url="http://maiseycharlie.jira.com/rest/api/3/dogs/tricks",
                    code=403,
                ),
                "Unknown error when requesting /rest/api/3/dogs/tricks",
            ),
        ]

        for unknown_error, expected_error_message in unknown_errors:
            mock_endpoint = MockErroringJiraEndpoint.as_view(error=unknown_error)

            request = self.make_request(method="GET")
            mock_endpoint(request)

            assert mock_super_handle_exception.call_args.args[1] == unknown_error
            assert str(unknown_error) == expected_error_message
            assert mock_logger.error.call_args.args[0] == "Unclear JIRA exception"
