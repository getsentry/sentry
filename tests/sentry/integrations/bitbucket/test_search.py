from unittest.mock import patch

import responses
from django.urls import reverse

from sentry.integrations.source_code_management.metrics import SourceCodeSearchEndpointHaltReason
from sentry.integrations.types import EventLifecycleOutcome
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.utils.test_assert_metrics import assert_halt_metric


@control_silo_test
class BitbucketSearchEndpointTest(APITestCase):
    def setUp(self):
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="bitbucket",
            external_id=self.subject,
            name="meredithanya",
            metadata={
                "base_url": self.base_url,
                "shared_secret": self.shared_secret,
                "subject": self.subject,
            },
        )

        self.login_as(self.user)
        self.path = reverse(
            "sentry-extensions-bitbucket-search", args=[self.organization.slug, self.integration.id]
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_search_issues(self, mock_record):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/meredithanya/apples/issues",
            json={
                "values": [
                    {"id": "123", "title": "Issue Title 123"},
                    {"id": "456", "title": "Issue Title 456"},
                ]
            },
        )
        resp = self.client.get(
            self.path,
            data={"field": "externalIssue", "query": "issue", "repo": "meredithanya/apples"},
        )

        assert resp.status_code == 200
        assert resp.data == [
            {"label": "#123 Issue Title 123", "value": "123"},
            {"label": "#456 Issue Title 456", "value": "456"},
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
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_search_repositories(self, mock_record):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/meredithanya",
            json={"values": [{"full_name": "meredithanya/apples"}]},
        )
        resp = self.client.get(self.path, data={"field": "repo", "query": "apple"})

        assert resp.status_code == 200
        assert resp.data == [{"label": "meredithanya/apples", "value": "meredithanya/apples"}]
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
    def test_search_repositories_no_issue_tracker(self, mock_record):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/meredithanya/apples/issues",
            json={"type": "error", "error": {"message": "Repository has no issue tracker."}},
            status=404,
        )
        resp = self.client.get(
            self.path,
            data={"field": "externalIssue", "query": "issue", "repo": "meredithanya/apples"},
        )
        assert resp.status_code == 400
        assert resp.data == {"detail": "Bitbucket Repository has no issue tracker."}
        assert len(mock_record.mock_calls) == 4
        start1, start2, halt1, halt2 = (
            mock_record.mock_calls
        )  # calls get, which calls handle_search_issues
        assert start1.args[0] == EventLifecycleOutcome.STARTED
        assert start2.args[0] == EventLifecycleOutcome.STARTED
        assert halt1.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, SourceCodeSearchEndpointHaltReason.NO_ISSUE_TRACKER.value)
        # NOTE: handle_search_issues returns without raising an API error, so for the
        # purposes of logging the GET request completes successfully
        assert halt2.args[0] == EventLifecycleOutcome.SUCCESS
