from unittest.mock import Mock, patch

from sentry.models.pullrequest import PullRequest
from sentry.seer.models.run import SeerRunPullRequest
from sentry.seer.pr_links import link_seer_run_to_pull_request
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"
RUN_STATE_ID = 4242


def _warning_events(mock_logger: Mock) -> list[str]:
    return [call.args[0] for call in mock_logger.warning.call_args_list]


class LinkSeerRunToPullRequestTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_STATE_ID
        )

    def _link(
        self,
        *,
        run_id: int = RUN_STATE_ID,
        repo_name: str = REPO_NAME,
        provider: str = "unknown",
        pr_number: int = 42,
    ) -> SeerRunPullRequest | None:
        return link_seer_run_to_pull_request(
            organization=self.organization,
            run_id=run_id,
            repo_name=repo_name,
            provider=provider,
            pr_number=pr_number,
        )

    def test_links_pull_request_to_seer_run(self) -> None:
        self._link()

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id == self.seer_run.id

    def test_returns_none_when_run_not_found(self) -> None:
        with patch("sentry.seer.pr_links.logger") as mock_logger:
            result = self._link(run_id=999999)

        assert result is None
        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.run_not_found" in _warning_events(mock_logger)

    def test_does_not_match_seer_run_from_another_org(self) -> None:
        other_org = self.create_organization()
        self.seer_run.delete()
        self.create_seer_run(organization=other_org, seer_run_state_id=RUN_STATE_ID)

        with patch("sentry.seer.pr_links.logger") as mock_logger:
            result = self._link()

        assert result is None
        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.run_not_found" in _warning_events(mock_logger)

    def test_reuses_canonical_pull_request_row(self) -> None:
        existing = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
            title="Pre-existing from SCM webhook",
        )

        self._link()

        existing.refresh_from_db()
        assert existing.title == "Pre-existing from SCM webhook"
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").count() == 1
        assert SeerRunPullRequest.objects.filter(pull_request=existing).count() == 1

    def test_is_idempotent_on_redelivery(self) -> None:
        self._link()
        self._link()

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert SeerRunPullRequest.objects.filter(pull_request=pull_request).count() == 1

    def test_links_multiple_pull_requests_for_one_run(self) -> None:
        other_repo = self.create_repo(
            self.project, name="getsentry/seer", provider="integrations:github"
        )

        self._link(pr_number=1)
        self._link(pr_number=2, repo_name="getsentry/seer")

        pr1 = PullRequest.objects.get(repository_id=self.repo.id, key="1")
        pr2 = PullRequest.objects.get(repository_id=other_repo.id, key="2")
        assert SeerRunPullRequest.objects.filter(seer_run=self.seer_run).count() == 2
        assert SeerRunPullRequest.objects.filter(pull_request=pr1).exists()
        assert SeerRunPullRequest.objects.filter(pull_request=pr2).exists()

    def test_returns_none_and_warns_when_repository_not_found(self) -> None:
        with patch("sentry.seer.pr_links.logger") as mock_logger:
            result = self._link(repo_name="getsentry/does-not-exist")

        assert result is None
        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.repo_unresolved" in _warning_events(mock_logger)

    def test_resolves_against_correct_org(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(other_project, name=REPO_NAME, provider="integrations:github")
        other_run = self.create_seer_run(organization=other_org, seer_run_state_id=5555)

        link_seer_run_to_pull_request(
            organization=other_org,
            run_id=5555,
            repo_name=REPO_NAME,
            provider="unknown",
            pr_number=42,
        )

        assert not PullRequest.objects.filter(repository_id=self.repo.id).exists()
        link = SeerRunPullRequest.objects.get(pull_request__repository_id=other_repo.id)
        assert link.seer_run_id == other_run.id

    def test_returns_none_when_repo_name_ambiguous(self) -> None:
        self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        with patch("sentry.seer.pr_links.logger") as mock_logger:
            result = self._link(provider="unknown")

        assert result is None
        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.repo_unresolved" in _warning_events(mock_logger)

    def test_disambiguates_by_provider(self) -> None:
        gitlab_repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        self._link(provider="github")

        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()
        assert not PullRequest.objects.filter(repository_id=gitlab_repo.id).exists()
