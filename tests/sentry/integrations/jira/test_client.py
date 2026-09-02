from unittest import mock

import jwt
import responses
from requests import PreparedRequest, Request
from responses.matchers import header_matcher, query_string_matcher

from sentry.integrations.jira.client import STATUS_SEARCH_MAX_PAGES, STATUS_SEARCH_PAGE_SIZE
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.utils import json

mock_jwt = "my-jwt-token"
control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


def mock_finalize_request(prepared_request: PreparedRequest) -> PreparedRequest:
    prepared_request.headers["Authorization"] = f"JWT {mock_jwt}"
    return prepared_request


@control_silo_test
class JiraClientTest(TestCase):
    def setUp(self) -> None:
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
    def test_get_field_autocomplete_for_non_customfield(
        self, mock_finalize: mock.MagicMock
    ) -> None:
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
    def test_get_field_autocomplete_for_customfield(self, mock_finalize: mock.MagicMock) -> None:
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
    def test_finalize_request(self) -> None:
        method = "GET"
        params = {"query": "1", "user": "me"}
        request = Request(
            method=method,
            url=f"{self.jira_client.base_url}{self.jira_client.SERVER_INFO_URL}",
            params=params,
        ).prepare()
        self.jira_client.finalize_request(prepared_request=request)

        # Extract JWT from Authorization header
        auth_header = request.headers["Authorization"]
        assert auth_header.startswith("JWT ")
        actual_jwt = auth_header.split(" ", 1)[1]
        decoded_jwt = jwt.decode(
            actual_jwt,
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
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.finalize_request",
        side_effect=mock_finalize_request,
    )
    def test_get_project_statuses_default_no_pagination(
        self, mock_finalize: mock.MagicMock
    ) -> None:
        """Without paginate=True, we make a single (200-capped) request and return it raw."""
        body = {"values": [{"id": "1", "name": "Status 1"}], "isLast": True}
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/statuses/search",
            body=json.dumps(body),
            status=200,
            content_type="application/json",
        )

        result = self.jira_client.get_project_statuses("99999")

        assert result == body
        assert len(responses.calls) == 1
        assert "startAt" not in responses.calls[0].request.url

    @responses.activate
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.finalize_request",
        side_effect=mock_finalize_request,
    )
    def test_get_project_statuses_single_page(self, mock_finalize: mock.MagicMock) -> None:
        statuses = [{"id": str(i), "name": f"Status {i}"} for i in range(5)]
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/statuses/search",
            body=json.dumps({"values": statuses, "isLast": True}),
            status=200,
            content_type="application/json",
        )

        result = self.jira_client.get_project_statuses("10001", paginate=True)

        assert result == {"values": statuses}
        assert len(responses.calls) == 1

    @responses.activate
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.finalize_request",
        side_effect=mock_finalize_request,
    )
    def test_get_project_statuses_multiple_pages(self, mock_finalize: mock.MagicMock) -> None:
        page1 = [{"id": str(i), "name": f"Status {i}"} for i in range(STATUS_SEARCH_PAGE_SIZE)]
        page2 = [
            {"id": str(i), "name": f"Status {i}"}
            for i in range(STATUS_SEARCH_PAGE_SIZE, STATUS_SEARCH_PAGE_SIZE + 50)
        ]
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/statuses/search",
            body=json.dumps({"values": page1, "isLast": False}),
            status=200,
            content_type="application/json",
        )
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/statuses/search",
            body=json.dumps({"values": page2, "isLast": True}),
            status=200,
            content_type="application/json",
        )

        result = self.jira_client.get_project_statuses("10001", paginate=True)

        assert result == {"values": page1 + page2}
        assert len(responses.calls) == 2

    @responses.activate
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.finalize_request",
        side_effect=mock_finalize_request,
    )
    def test_get_project_statuses_page_cap(self, mock_finalize: mock.MagicMock) -> None:
        full_page = [{"id": str(i), "name": f"Status {i}"} for i in range(STATUS_SEARCH_PAGE_SIZE)]
        for _ in range(STATUS_SEARCH_MAX_PAGES):
            responses.add(
                method=responses.GET,
                url="https://example.atlassian.net/rest/api/2/statuses/search",
                body=json.dumps({"values": full_page, "isLast": False}),
                status=200,
                content_type="application/json",
            )

        result = self.jira_client.get_project_statuses("10001", paginate=True)

        assert len(result["values"]) == STATUS_SEARCH_PAGE_SIZE * STATUS_SEARCH_MAX_PAGES
        assert len(responses.calls) == STATUS_SEARCH_MAX_PAGES

    @responses.activate
    @mock.patch(
        "sentry.integrations.jira.integration.JiraCloudClient.finalize_request",
        side_effect=mock_finalize_request,
    )
    def test_get_project_statuses_stops_on_short_page(self, mock_finalize: mock.MagicMock) -> None:
        """Even if isLast is not set, a short page stops pagination."""
        short_page = [{"id": "1", "name": "Status 1"}]
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/statuses/search",
            body=json.dumps({"values": short_page}),
            status=200,
            content_type="application/json",
        )

        result = self.jira_client.get_project_statuses("10001", paginate=True)

        assert result == {"values": short_page}
        assert len(responses.calls) == 1
