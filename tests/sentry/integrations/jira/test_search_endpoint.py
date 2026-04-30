from functools import cached_property
from unittest import mock
from urllib.parse import parse_qs, urlparse

import responses
from django.urls import reverse

from fixtures.integrations.stub_service import StubService
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_halt_metric,
    assert_many_halt_metrics,
    assert_middleware_metrics,
    assert_slo_metric_calls,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


def _assert_search_slo_metric(mock_record, outcome=EventLifecycleOutcome.SUCCESS):
    """
    The IntegrationEndpoint base class records its own SLO middleware metrics
    around every request, so per request `mock_record` receives:
      4 middleware calls (2 starts + 2 successes) + 2 product calls (1 start + 1 outcome).
    Slice out the product calls and assert the middleware bookends.
    """
    assert len(mock_record.mock_calls) == 6
    middleware_calls = mock_record.mock_calls[:3] + mock_record.mock_calls[-1:]
    assert_middleware_metrics(middleware_calls)
    product_calls = mock_record.mock_calls[3:-1]
    assert_slo_metric_calls(product_calls, outcome)


@control_silo_test
class JiraSearchEndpointTest(APITestCase):
    @cached_property
    def integration(self):
        integration = self.create_provider_integration(
            provider="jira",
            name="Jira Cloud",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)
        return integration

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_issue_search_text(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/jql/",
            body=StubService.get_stub_json("jira", "search_response.json"),
            content_type="json",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?field=externalIssue&query=test")
        assert resp.status_code == 200
        assert resp.data == [{"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}]
        _assert_search_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_issue_search_id(self, mock_record: mock.MagicMock) -> None:
        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert 'id="hsp-1"' == query["jql"][0]
            data = StubService.get_stub_json("jira", "search_response.json")
            return 200, {}, data

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/jql/",
            callback=responder,
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        # queries come through from the front end lowercased, so HSP-1 -> hsp-1
        for field in ("externalIssue", "parent"):
            resp = self.client.get(f"{path}?field={field}&query=hsp-1")
            assert resp.status_code == 200
            assert resp.data == [
                {"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}
            ]

        # 6 mock calls per request (4 middleware + 2 product) for 2 requests = 12.
        assert mock_record.call_count == 12
        # 6 STARTED (3 per request) + 6 SUCCESS (3 per request).
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 6)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 6)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.HALTED, 0)

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_issue_search_error(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/jql/",
            status=500,
            body="Totally broken",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        for field in ("externalIssue", "parent"):
            resp = self.client.get(f"{path}?field={field}&query=test")
            assert resp.status_code == 400
            assert resp.data == {"detail": "Something went wrong while communicating with Jira"}

        # 6 mock calls per request (4 middleware + 2 product) for 2 requests = 12.
        assert mock_record.call_count == 12
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 6)
        # 4 middleware successes (2 per request); product calls record halt.
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 4)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.HALTED, 2)
        assert_many_halt_metrics(mock_record, [IntegrationError(""), IntegrationError("")])

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assignee_search(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
        )

        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert "HSP" == query["project"][0]
            assert "bob" == query["query"][0]
            data = StubService.get_stub_json("jira", "user_search_response.json")
            return 200, {}, data

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            callback=responder,
            content_type="json",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?project=10000&field=assignee&query=bob")
        assert resp.status_code == 200
        assert resp.data == [{"value": "deadbeef123", "label": "Bobby - bob@example.org"}]
        _assert_search_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assignee_search_error(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            status=500,
            body="Bad things",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?project=10000&field=assignee&query=bob")
        assert resp.status_code == 400
        _assert_search_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiError(""))

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_customfield_search(self, mock_record: mock.MagicMock) -> None:
        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert "cf[0123]" == query["fieldName"][0]
            assert "sp" == query["fieldValue"][0]
            return 200, {}, '{"results": [{"displayName": "<b>Sp</b>rint 1 (1)", "value": "1"}]}'

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            callback=responder,
            content_type="application/json",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?field=customfield_0123&query=sp")
        assert resp.status_code == 200
        assert resp.data == [{"label": "Sprint 1 (1)", "value": "1"}]
        _assert_search_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_customfield_search_error(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            status=500,
            body="Totally broken",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?field=customfield_0123&query=sp")
        assert resp.status_code == 400
        assert resp.data == {
            "detail": "Unable to fetch autocomplete for customfield_0123 from Jira"
        }
        _assert_search_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiError(""))

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_project_search_with_pagination(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "key": "EX", "name": "Example"},
                ],
                "total": 2,
            },
        )

        self.login_as(self.user)

        path = reverse(
            "sentry-extensions-jira-search", args=[self.organization.slug, self.integration.id]
        )

        resp = self.client.get(f"{path}?field=project&query=example")
        assert resp.status_code == 200
        assert resp.data == [
            {"label": "EX - Example", "value": "10000"},
        ]
        _assert_search_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_project_search_error_with_pagination(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            status=500,
            body="susge",
        )

        self.login_as(self.user)

        path = reverse(
            "sentry-extensions-jira-search", args=[self.organization.slug, self.integration.id]
        )

        resp = self.client.get(f"{path}?field=project&query=example")
        assert resp.status_code == 400
        assert resp.data == {"detail": "Unable to fetch projects from Jira"}
        _assert_search_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiError(""))
