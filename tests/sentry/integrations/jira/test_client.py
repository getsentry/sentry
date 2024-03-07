from unittest import mock

import jwt
import responses
from requests import PreparedRequest, Request
from responses.matchers import header_matcher, query_string_matcher

from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.utils import json

mock_jwt = "my-jwt-token"
control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


def mock_finalize_request(prepared_request: PreparedRequest):
    prepared_request.headers["Authorization"] = f"JWT {mock_jwt}"
    return prepared_request


@control_silo_test
class JiraClientTest(TestCase):
    def setUp(self):
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="jira",
            name="Jira Cloud",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        install = self.integration.get_installation(self.organization.id)
        self.jira_client = install.get_client()

    @responses.activate
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.finalize_request",
        side_effect=mock_finalize_request,
    )
    def test_get_field_autocomplete_for_non_customfield(self, mock_finalize):
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
        "sentry.integrations.jira.integration.JiraCloudClient.finalize_request",
        side_effect=mock_finalize_request,
    )
    def test_get_field_autocomplete_for_customfield(self, mock_finalize):
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
    def test_finalize_request(self):
        method = "GET"
        params = {"query": "1", "user": "me"}
        request = Request(
            method=method,
            url=f"{self.jira_client.base_url}{self.jira_client.SERVER_INFO_URL}",
            params=params,
        ).prepare()
        self.jira_client.finalize_request(prepared_request=request)

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
