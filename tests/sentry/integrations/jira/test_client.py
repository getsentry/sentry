import re
from unittest import mock

import jwt
import responses
from django.test import override_settings
from requests import PreparedRequest, Request
from responses.matchers import header_matcher, query_string_matcher

from sentry.integrations.jira.client import JiraCloudClient
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.models.integrations.integration import Integration
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response

mock_jwt = "my-jwt-token"
control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


def mock_authorize_request(prepared_request: PreparedRequest):
    prepared_request.headers["Authorization"] = f"JWT {mock_jwt}"
    return prepared_request


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
@control_silo_test
class JiraClientTest(TestCase):
    def setUp(self):
        self.integration = Integration.objects.create(
            provider="jira",
            name="Jira Cloud",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        install = self.integration.get_installation(self.organization.id)
        self.jira_client = install.get_client()

    @responses.activate
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.authorize_request",
        side_effect=mock_authorize_request,
    )
    def test_get_field_autocomplete_for_non_customfield(self, mock_authorize):
        body = {"results": [{"value": "ISSUE-1", "displayName": "My Issue (ISSUE-1)"}]}
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            match=[
                query_string_matcher("fieldName=my_field&fieldValue=abc"),
                header_matcher({"Authorization": f"JWT {mock_jwt}"}),
            ],
            body=json.dumps(body),
            status=200,
            content_type="application/json",
        )
        res = self.jira_client.get_field_autocomplete("my_field", "abc")
        assert res == body

    @responses.activate
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.authorize_request",
        side_effect=mock_authorize_request,
    )
    def test_get_field_autocomplete_for_customfield(self, mock_authorize):
        body = {"results": [{"value": "ISSUE-1", "displayName": "My Issue (ISSUE-1)"}]}
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            match=[
                query_string_matcher("fieldName=cf[0123]&fieldValue=abc"),
                header_matcher({"Authorization": f"JWT {mock_jwt}"}),
            ],
            body=json.dumps(body),
            status=200,
            content_type="application/json",
        )
        res = self.jira_client.get_field_autocomplete("customfield_0123", "abc")
        assert res == body

    @freeze_time("2023-01-01 01:01:01")
    def test_authorize_request(self):
        method = "GET"
        params = {"query": "1", "user": "me"}
        request = Request(
            method=method,
            url=f"{self.jira_client.base_url}{self.jira_client.SERVER_INFO_URL}",
            params=params,
        ).prepare()
        self.jira_client.authorize_request(prepared_request=request)

        raw_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0c2VydmVyLmppcmEiLCJpYXQiOjE2NzI1MzQ4NjEsImV4cCI6MTY3MjUzNTE2MSwicXNoIjoiZGU5NTIwMTA2NDBhYjJjZmQyMDYyNzgxYjU0ZTk0Yjc4ZmNlMTY3MzEwMDZkYjdkZWVhZmZjZWI0MjVmZTI0MiJ9.tydfCeXBICtX_xtgsOEiDJFmVPo6MmaAh1Bojouprjc"
        assert request.headers["Authorization"] == f"JWT {raw_jwt}"
        decoded_jwt = jwt.decode(
            raw_jwt,
            key=self.integration.metadata["shared_secret"],
            algorithms=["HS256"],
        )
        assert decoded_jwt == {
            "exp": 1672535161,
            "iat": 1672534861,
            "iss": "testserver.jira",
            "qsh": get_query_hash(
                uri=self.jira_client.SERVER_INFO_URL, method=method, query_params=params
            ),
        }

    @responses.activate
    def test_integration_proxy_is_active(self):
        class JiraCloudProxyTestClient(JiraCloudClient):
            _use_proxy_url_for_tests = True

            def assert_proxy_request(self, request, is_proxy=True):
                assert (PROXY_BASE_PATH in request.url) == is_proxy
                assert (PROXY_OI_HEADER in request.headers) == is_proxy
                assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
                assert ("Authorization" in request.headers) != is_proxy
                if is_proxy:
                    assert request.headers[PROXY_OI_HEADER] is not None

        jira_response = responses.add(
            method=responses.GET,
            url=re.compile(rf"\S+{self.jira_client.SERVER_INFO_URL}$"),
            json={"ok": True},
            status=200,
        )

        control_proxy_response = add_control_silo_proxy_response(
            method=responses.GET,
            path=self.jira_client.SERVER_INFO_URL,
            json={"ok": True},
            status=200,
        )

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = JiraCloudProxyTestClient(integration=self.integration, verify_ssl=True)
            client.get_server_info()
            request = responses.calls[0].request

            assert client.SERVER_INFO_URL in request.url
            assert client.base_url in request.url
            assert jira_response.call_count == 1
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = JiraCloudProxyTestClient(integration=self.integration, verify_ssl=True)
            client.get_server_info()
            request = responses.calls[0].request

            assert client.SERVER_INFO_URL in request.url
            assert client.base_url in request.url
            assert jira_response.call_count == 2
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        assert control_proxy_response.call_count == 0
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = JiraCloudProxyTestClient(integration=self.integration, verify_ssl=True)
            client.get_server_info()
            request = responses.calls[0].request

            assert control_proxy_response.call_count == 1
            assert client.base_url not in request.url
            client.assert_proxy_request(request, is_proxy=True)
