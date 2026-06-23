from typing import Any
from unittest.mock import Mock, patch

from sentry.models.pullrequest import PullRequest
from sentry.seer.models.run import SeerRunPullRequest
from sentry.seer.pull_requests import (
    link_seer_run_to_pull_requests,
    maybe_link_seer_run_to_pull_requests,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

REPO_NAME = "getsentry/sentry"
RUN_STATE_ID = 4242


def _warning_events(mock_logger: Mock) -> list[str]:
    return [call.args[0] for call in mock_logger.warning.call_args_list]


def _pr(pr_number: int = 42, provider: str = "unknown", repo_name: str = REPO_NAME) -> dict[str, Any]:
    return {
        "provider": provider,
        "repo_name": repo_name,
        "pull_request": {
            "pr_number": pr_number,
            "pr_url": f"https://github.com/getsentry/sentry/pull/{pr_number}",
        },
    }


class LinkSeerRunToPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_STATE_ID
        )

    def _link(self, pull_requests: list[dict[str, Any]], *, run_id: int = RUN_STATE_ID) -> None:
        link_seer_run_to_pull_requests(
            organization=self.organization, pull_requests=pull_requests, run_id=run_id
        )

    def test_links_pull_request_to_seer_run(self) -> None:
        self._link([_pr()])

        pr = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert SeerRunPullRequest.objects.get(pull_request=pr).seer_run_id == self.seer_run.id

    def test_links_multiple_pull_requests(self) -> None:
        other_repo = self.create_repo(
            self.project, name="getsentry/seer", provider="integrations:github"
        )

        self._link([_pr(pr_number=1), _pr(pr_number=2, repo_name="getsentry/seer")])

        assert SeerRunPullRequest.objects.filter(seer_run=self.seer_run).count() == 2
        assert SeerRunPullRequest.objects.filter(
            pull_request=PullRequest.objects.get(repository_id=self.repo.id, key="1")
        ).exists()
        assert SeerRunPullRequest.objects.filter(
            pull_request=PullRequest.objects.get(repository_id=other_repo.id, key="2")
        ).exists()

    def test_no_links_when_run_not_found(self) -> None:
        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            self._link([_pr()], run_id=999999)

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.run_not_found" in _warning_events(mock_logger)

    def test_run_lookup_is_org_scoped(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.create_repo(other_project, name=REPO_NAME, provider="integrations:github")

        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            link_seer_run_to_pull_requests(
                organization=other_org, pull_requests=[_pr()], run_id=RUN_STATE_ID
            )

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.run_not_found" in _warning_events(mock_logger)

    def test_reuses_canonical_pull_request_row(self) -> None:
        existing = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
            title="Pre-existing from SCM webhook",
        )

        self._link([_pr()])

        existing.refresh_from_db()
        assert existing.title == "Pre-existing from SCM webhook"
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").count() == 1
        assert SeerRunPullRequest.objects.filter(pull_request=existing).count() == 1

    def test_is_idempotent_on_redelivery(self) -> None:
        self._link([_pr()])
        self._link([_pr()])

        pr = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert SeerRunPullRequest.objects.filter(pull_request=pr).count() == 1

    def test_skips_unresolvable_repo(self) -> None:
        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            self._link([_pr(repo_name="getsentry/does-not-exist")])

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.repo_unresolved" in _warning_events(mock_logger)

    def test_skips_entry_missing_fields(self) -> None:
        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            self._link(
                [
                    {"provider": "unknown", "pull_request": {"pr_number": 1}},  # no repo_name
                    {"provider": "unknown", "repo_name": REPO_NAME, "pull_request": {}},  # no number
                ]
            )

        assert not SeerRunPullRequest.objects.exists()
        assert _warning_events(mock_logger).count("seer.pr_link.missing_fields") == 2

    def test_one_bad_entry_does_not_drop_the_rest(self) -> None:
        self._link([_pr(pr_number=1, repo_name="getsentry/does-not-exist"), _pr(pr_number=2)])

        assert not PullRequest.objects.filter(key="1").exists()
        pr2 = PullRequest.objects.get(repository_id=self.repo.id, key="2")
        assert SeerRunPullRequest.objects.filter(pull_request=pr2).exists()


class MaybeLinkSeerRunToPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_STATE_ID)

    def _maybe_link(self) -> None:
        maybe_link_seer_run_to_pull_requests(
            organization=self.organization, pull_requests=[_pr()], run_id=RUN_STATE_ID
        )

    def test_links_when_killswitch_off(self) -> None:
        self._maybe_link()

        pr = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert SeerRunPullRequest.objects.filter(pull_request=pr).exists()

    def test_killswitch_skips_linking(self) -> None:
        with override_options({"seer.run-pr-link.killswitch.enabled": True}):
            self._maybe_link()

        assert not SeerRunPullRequest.objects.exists()

    def test_swallows_exceptions(self) -> None:
        with patch(
            "sentry.seer.pull_requests.link_seer_run_to_pull_requests",
            side_effect=RuntimeError("boom"),
        ):
            # Must not raise.
            self._maybe_link()
