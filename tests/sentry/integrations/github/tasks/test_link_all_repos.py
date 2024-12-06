from unittest.mock import patch

import pytest
import responses
from django.db import IntegrityError

from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.github.tasks.link_all_repos import link_all_repos
from sentry.integrations.source_code_management.metrics import LinkAllReposHaltReason
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class LinkAllReposTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"
    key = "github"

    def _add_responses(self):
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={
                "total_count": 2,
                "repositories": [
                    {
                        "id": 1,
                        "full_name": "getsentry/sentry",
                    },
                    {
                        "id": 2,
                        "full_name": "getsentry/snuba",
                    },
                ],
            },
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.github.tasks.link_all_repos.metrics")
    def test_link_all_repos_inactive_integration(self, mock_metrics, mock_record, _):
        self.integration.update(status=ObjectStatus.DISABLED)

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        mock_metrics.incr.assert_called_with(
            "github.link_all_repos.error", tags={"type": "missing_integration"}
        )

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, LinkAllReposHaltReason.MISSING_INTEGRATION.value)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_all_repos(self, mock_record, _):
        self._add_responses()

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            repos = Repository.objects.all()
        assert len(repos) == 2

        for repo in repos:
            assert repo.organization_id == self.organization.id
            assert repo.provider == "integrations:github"

        assert repos[0].name == "getsentry/sentry"
        assert repos[1].name == "getsentry/snuba"

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_all_repos_api_response_keyerror(self, mock_record, _):

        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={
                "total_count": 2,
                "repositories": [
                    {
                        "full_name": "getsentry/sentry",
                    },
                    {
                        "id": 2,
                        "full_name": "getsentry/snuba",
                    },
                ],
            },
        )

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].organization_id == self.organization.id
        assert repos[0].provider == "integrations:github"

        assert repos[0].name == "getsentry/snuba"

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_all_repos_api_response_keyerror_single_repo(self, mock_record, _):

        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={
                "total_count": 2,
                "repositories": [
                    {
                        "full_name": "getsentry/sentry",
                    },
                ],
            },
        )

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            repos = Repository.objects.all()
        assert len(repos) == 0

        start, halt = mock_record.mock_calls

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, LinkAllReposHaltReason.REPOSITORY_NOT_CREATED.value)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.github.tasks.link_all_repos.metrics")
    def test_link_all_repos_missing_integration(self, mock_metrics, mock_record, _):
        link_all_repos(
            integration_key=self.key,
            integration_id=0,
            organization_id=self.organization.id,
        )
        mock_metrics.incr.assert_called_with(
            "github.link_all_repos.error", tags={"type": "missing_integration"}
        )

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, LinkAllReposHaltReason.MISSING_INTEGRATION.value)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.github.tasks.link_all_repos.metrics")
    def test_link_all_repos_missing_organization(self, mock_metrics, mock_record, _):
        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=0,
        )
        mock_metrics.incr.assert_called_with(
            "github.link_all_repos.error", tags={"type": "missing_organization"}
        )

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, LinkAllReposHaltReason.MISSING_ORGANIZATION.value)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.github.tasks.link_all_repos.metrics")
    @responses.activate
    def test_link_all_repos_api_error(self, mock_metrics, mock_record, _):

        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=400,
        )

        with pytest.raises(ApiError):
            link_all_repos(
                integration_key=self.key,
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )
        mock_metrics.incr.assert_called_with("github.link_all_repos.api_error")

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.FAILURE

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.github.integration.metrics")
    @responses.activate
    def test_link_all_repos_api_error_rate_limited(self, mock_metrics, mock_record, _):

        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=400,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        mock_metrics.incr.assert_called_with("github.link_all_repos.rate_limited_error")

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, LinkAllReposHaltReason.RATE_LIMITED.value)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.models.Repository.objects.create")
    @patch("sentry.integrations.github.tasks.link_all_repos.metrics")
    @responses.activate
    def test_link_all_repos_repo_creation_error(self, mock_metrics, mock_repo, mock_record, _):
        mock_repo.side_effect = IntegrityError

        self._add_responses()

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        mock_metrics.incr.assert_called_with("sentry.integration_repo_provider.repo_exists")

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, LinkAllReposHaltReason.REPOSITORY_NOT_CREATED.value)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.services.repository.repository_service.create_repository")
    @patch("sentry.plugins.providers.IntegrationRepositoryProvider.on_delete_repository")
    @responses.activate
    def test_link_all_repos_repo_creation_exception(
        self, mock_delete_repo, mock_create_repository, mock_record, _
    ):
        mock_create_repository.return_value = None
        mock_delete_repo.side_effect = Exception

        self._add_responses()

        with pytest.raises(Exception):
            link_all_repos(
                integration_key=self.key,
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.FAILURE
