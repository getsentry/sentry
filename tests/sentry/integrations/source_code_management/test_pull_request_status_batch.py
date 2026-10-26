from collections.abc import Sequence
from unittest import mock

from sentry.api.serializers.models.pullrequest import PullRequestStatus
from sentry.integrations.source_code_management.pull_request_status_batch import (
    get_checks_and_review,
)
from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    PullRequestStatusClient,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.testutils.cases import TestCase

_INTEGRATION_SERVICE = (
    "sentry.integrations.source_code_management.pull_request_status_batch."
    "integration_service.get_integration"
)


class PullRequestStatusClientFake(PullRequestStatusClient):
    def __init__(self) -> None:
        # One entry per call, each holding that call's requested keys.
        self.calls: list[list[str]] = []

    def get_pull_request_statuses(
        self, pull_requests: Sequence[PullRequestStatusRequest]
    ) -> dict[PullRequestStatusRequest, PullRequestStatusResult]:
        self.calls.append([pull_request.pull_number for pull_request in pull_requests])
        return {
            pull_request: PullRequestStatusResult(checks=AggregateChecksStatus.SUCCESS)
            for pull_request in pull_requests
        }


class GetChecksAndReviewTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=123,
        )

    def _set_client(
        self, mock_get_integration: mock.MagicMock, client: PullRequestStatusClientFake
    ) -> None:
        installation = mock.Mock()
        installation.get_client.return_value = client
        integration = mock.Mock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration

    @mock.patch(_INTEGRATION_SERVICE)
    def test_non_numeric_keys_are_skipped(self, mock_get_integration: mock.MagicMock) -> None:
        client = PullRequestStatusClientFake()
        self._set_client(mock_get_integration, client)
        good = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="7"
        )
        bad = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="²"
        )
        status_by_pr_id: dict[int, PullRequestStatus | None] = {good.id: "open", bad.id: "open"}

        results = get_checks_and_review([good, bad], {self.repo.id: self.repo}, status_by_pr_id)

        # "²".isdigit() is True but int("²") raises; the good sibling must still
        # be enriched instead of the whole integration batch being discarded.
        assert client.calls == [["7"]]
        assert list(results) == [good.id]
