from datetime import datetime, timedelta
from unittest.mock import patch

import responses
from django.urls import reverse

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.source_code_management.metrics import SourceCodeSearchEndpointHaltReason
from sentry.integrations.types import EventLifecycleOutcome
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity
from tests.sentry.integrations.utils.test_assert_metrics import assert_halt_metric


@control_silo_test
class GithubSearchTest(APITestCase):
    # There is another test case that inherits from this
    # one to ensure that github:enterprise behaves as expected.
    provider = "github"
    base_url = "https://api.github.com"

    def _create_integration(self):
        future = datetime.now() + timedelta(hours=1)
        return self.create_provider_integration(
            provider=self.provider,
            name="test",
            external_id=9999,
            metadata={
                "domain_name": "github.com/test",
                "account_type": "Organization",
                "access_token": "123456789",
                "expires_at": future.replace(microsecond=0).isoformat(),
            },
        )

    def setUp(self):
        super().setUp()
        self.integration = self._create_integration()
        identity = Identity.objects.create(
            idp=self.create_identity_provider(type=self.provider),
            user=self.user,
            external_id=str(self.user.id),
            data={"access_token": "123456789"},
        )
        self.integration.add_organization(self.organization, self.user, identity.id)
        self.installation = self.integration.get_installation(self.organization.id)

        self.login_as(self.user)
        self.url = reverse(
            "sentry-integration-github-search",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "integration_id": self.installation.model.id,
            },
        )

    # Happy Paths
    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_finds_external_issue_results(self, mock_record):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%20AEIOU",
            json={
                "items": [
                    {"number": 25, "title": "AEIOU Error"},
                    {"number": 45, "title": "AEIOU Error"},
                ]
            },
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "AEIOU", "repo": "example"}
        )

        assert resp.status_code == 200
        assert resp.data == [
            {"value": 25, "label": "#25 AEIOU Error"},
            {"value": 45, "label": "#45 AEIOU Error"},
        ]
        assert len(mock_record.mock_calls) == 4
        start1, start2, halt1, halt2 = (
            mock_record.mock_calls
        )  # calls get, which calls handle_search_issues
        assert start1.args[0] == EventLifecycleOutcome.STARTED
        assert start2.args[0] == EventLifecycleOutcome.STARTED
        assert halt1.args[0] == EventLifecycleOutcome.SUCCESS
        assert halt2.args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    def test_finds_external_issue_results_with_id(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%2025",
            json={"items": [{"number": 25, "title": "AEIOU Error"}]},
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "25", "repo": "example"}
        )

        assert resp.status_code == 200
        assert resp.data == [{"value": 25, "label": "#25 AEIOU Error"}]

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_finds_repo_results(self, mock_record):
        responses.add(
            responses.GET,
            self.base_url + "/search/repositories?q=org:test%20ex",
            json={
                "items": [
                    {"name": "example", "full_name": "test/example"},
                    {"name": "exhaust", "full_name": "test/exhaust"},
                ]
            },
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "ex"})

        assert resp.status_code == 200
        assert resp.data == [
            {"value": "test/example", "label": "example"},
            {"value": "test/exhaust", "label": "exhaust"},
        ]
        assert len(mock_record.mock_calls) == 4
        start1, start2, halt1, halt2 = (
            mock_record.mock_calls
        )  # calls get, which calls handle_search_repositories
        assert start1.args[0] == EventLifecycleOutcome.STARTED
        assert start2.args[0] == EventLifecycleOutcome.STARTED
        assert halt1.args[0] == EventLifecycleOutcome.SUCCESS
        assert halt2.args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_repo_search_validation_error(self, mock_record):
        responses.add(
            responses.GET,
            self.base_url + "/search/repositories?q=org:test%20nope",
            json={
                "message": "Validation Error",
                "errors": [{"message": "Cannot search for that org"}],
            },
            status=422,
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "nope", "repo": "example"})
        assert resp.status_code == 404
        assert "detail" in resp.data
        assert len(mock_record.mock_calls) == 4
        start1, start2, halt1, halt2 = mock_record.mock_calls
        assert start1.args[0] == EventLifecycleOutcome.STARTED
        assert start2.args[0] == EventLifecycleOutcome.STARTED
        assert halt1.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(
            mock_record, SourceCodeSearchEndpointHaltReason.MISSING_REPOSITORY_OR_NO_ACCESS.value
        )
        # NOTE: handle_search_repositories returns without raising an API error, so for the
        # purposes of logging the GET request completes successfully
        assert halt2.args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    def test_finds_no_external_issues_results(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%20nope",
            json={"items": []},
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "nope", "repo": "example"}
        )

        assert resp.status_code == 200
        assert resp.data == []

    @responses.activate
    def test_finds_no_project_results(self):
        responses.add(
            responses.GET, self.base_url + "/search/repositories?q=org:test%20nope", json={}
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "nope"})

        assert resp.status_code == 200
        assert resp.data == []

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_search_issues_rate_limit(self, mock_record):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%20ex",
            status=403,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://developer.github.com/v3/#rate-limiting",
            },
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "ex", "repo": "example"}
        )
        assert resp.status_code == 429
        assert len(mock_record.mock_calls) == 4
        start1, start2, halt1, halt2 = mock_record.mock_calls
        assert start1.args[0] == EventLifecycleOutcome.STARTED
        assert start2.args[0] == EventLifecycleOutcome.STARTED
        assert halt1.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, SourceCodeSearchEndpointHaltReason.RATE_LIMITED.value)
        # NOTE: handle_search_issues returns without raising an API error, so for the
        # purposes of logging the GET request completes successfully
        assert halt2.args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_search_project_rate_limit(self, mock_record):
        responses.add(
            responses.GET,
            self.base_url + "/search/repositories?q=org:test%20ex",
            status=403,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://developer.github.com/v3/#rate-limiting",
            },
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "ex"})
        assert resp.status_code == 429
        assert len(mock_record.mock_calls) == 4
        start1, start2, halt1, halt2 = mock_record.mock_calls
        assert start1.args[0] == EventLifecycleOutcome.STARTED
        assert start2.args[0] == EventLifecycleOutcome.STARTED
        assert halt1.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, SourceCodeSearchEndpointHaltReason.RATE_LIMITED.value)
        # NOTE: handle_search_repositories returns without raising an API error, so for the
        # purposes of logging the GET request completes successfully
        assert halt2.args[0] == EventLifecycleOutcome.SUCCESS

    # Request Validations
    # Test observability requests for GET requests failures here
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_missing_field(self, mock_record):
        resp = self.client.get(self.url, data={"query": "XYZ"})
        assert resp.status_code == 400
        assert len(mock_record.mock_calls) == 2
        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, SourceCodeSearchEndpointHaltReason.SERIALIZER_ERRORS.value)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_missing_query(self, mock_record):
        resp = self.client.get(self.url, data={"field": "externalIssue"})

        assert resp.status_code == 400
        assert len(mock_record.mock_calls) == 2
        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, SourceCodeSearchEndpointHaltReason.SERIALIZER_ERRORS.value)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_missing_repository(self, mock_record):
        resp = self.client.get(self.url, data={"field": "externalIssue", "query": "XYZ"})

        assert resp.status_code == 400
        assert len(mock_record.mock_calls) == 2
        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(
            mock_record, SourceCodeSearchEndpointHaltReason.MISSING_REPOSITORY_FIELD.value
        )

    def test_invalid_field(self):
        resp = self.client.get(self.url, data={"field": "invalid-field", "query": "nope"})

        assert resp.status_code == 400

    # Missing Resources
    # Test observability requests for GET requests failures here
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_missing_integration(self, mock_record):
        url = reverse(
            "sentry-integration-github-search",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "integration_id": "1234567890",
            },
        )
        resp = self.client.get(
            url, data={"field": "externalIssue", "query": "search", "repo": "example"}
        )

        assert resp.status_code == 404
        assert len(mock_record.mock_calls) == 2
        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(
            mock_record, SourceCodeSearchEndpointHaltReason.MISSING_INTEGRATION.value
        )

    def test_missing_installation(self):
        # remove organization integration aka "uninstalling" installation
        org_integration = OrganizationIntegration.objects.get(
            id=self.installation.org_integration.id
        )
        org_integration.delete()

        resp = self.client.get(self.url, data={"field": "repo", "query": "not-found"})

        assert resp.status_code == 404

    # Distributed System Issues
    @responses.activate
    def test_search_issues_request_fails(self):
        responses.add(
            responses.GET, self.base_url + "/search/issues?q=repo:example%20ex", status=503
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "ex", "repo": "example"}
        )
        assert resp.status_code == 503

    @responses.activate
    def test_projects_request_fails(self):
        responses.add(
            responses.GET, self.base_url + "/search/repositories?q=org:test%20ex", status=503
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "ex"})
        assert resp.status_code == 503
