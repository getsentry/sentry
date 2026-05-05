from functools import cached_property
from unittest import mock
from urllib.parse import parse_qs, urlparse

import responses
from django.urls import reverse

from fixtures.integrations.stub_service import StubService
from sentry.integrations.project_management.metrics import ProjectManagementActionType
from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycle, IntegrationEventLifecycleMetric
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


def _assert_search_outcome(
    mock_record: mock.MagicMock,
    interaction_type: ProjectManagementActionType,
    outcome: EventLifecycleOutcome,
    expected_exception: type[BaseException] | None = None,
    count: int = 1,
) -> None:
    """Assert lifecycle (STARTED, outcome) pairs for a single interaction type.

    The endpoint base class wraps every request with its own SLO middleware
    lifecycles, so filtering ``mock_record.mock_calls`` by the search
    ``interaction_type`` isolates the product event we actually care about.
    Requires the ``record_event`` patch to use ``autospec=True`` so that
    ``call.args[0]`` is the bound ``EventLifecycle`` instance.
    """
    calls = [
        call
        for call in mock_record.mock_calls
        if call.args
        and isinstance(call.args[0], EventLifecycle)
        and isinstance(call.args[0].payload, IntegrationEventLifecycleMetric)
        and call.args[0].payload.get_interaction_type() == str(interaction_type)
    ]
    assert len(calls) == 2 * count, (
        f"Expected {2 * count} lifecycle calls for {interaction_type}, got {len(calls)}"
    )
    for i in range(count):
        start, end = calls[2 * i], calls[2 * i + 1]
        assert start.args[1] == EventLifecycleOutcome.STARTED
        assert end.args[1] == outcome
        if expected_exception is not None:
            assert isinstance(end.args[2], expected_exception)


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
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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
        _assert_search_outcome(
            mock_record, ProjectManagementActionType.SEARCH_ISSUES, EventLifecycleOutcome.SUCCESS
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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

        _assert_search_outcome(
            mock_record,
            ProjectManagementActionType.SEARCH_ISSUES,
            EventLifecycleOutcome.SUCCESS,
            count=2,
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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

        _assert_search_outcome(
            mock_record,
            ProjectManagementActionType.SEARCH_ISSUES,
            EventLifecycleOutcome.HALTED,
            expected_exception=IntegrationError,
            count=2,
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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
        _assert_search_outcome(
            mock_record, ProjectManagementActionType.SEARCH_USERS, EventLifecycleOutcome.SUCCESS
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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
        _assert_search_outcome(
            mock_record,
            ProjectManagementActionType.SEARCH_USERS,
            EventLifecycleOutcome.HALTED,
            expected_exception=ApiError,
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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
        _assert_search_outcome(
            mock_record,
            ProjectManagementActionType.SEARCH_FIELD_AUTOCOMPLETE,
            EventLifecycleOutcome.SUCCESS,
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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
        _assert_search_outcome(
            mock_record,
            ProjectManagementActionType.SEARCH_FIELD_AUTOCOMPLETE,
            EventLifecycleOutcome.HALTED,
            expected_exception=ApiError,
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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
        _assert_search_outcome(
            mock_record, ProjectManagementActionType.SEARCH_PROJECTS, EventLifecycleOutcome.SUCCESS
        )

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event", autospec=True)
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
        _assert_search_outcome(
            mock_record,
            ProjectManagementActionType.SEARCH_PROJECTS,
            EventLifecycleOutcome.HALTED,
            expected_exception=ApiError,
        )
