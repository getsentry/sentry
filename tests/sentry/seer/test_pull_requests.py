from typing import Any
from unittest.mock import patch

from sentry.models.pullrequest import PullRequest
from sentry.seer.models.run import SeerRunPullRequest
from sentry.seer.pull_requests import (
    get_or_create_seer_pull_request,
    link_seer_run_to_pull_requests,
    maybe_link_seer_run_to_pull_requests,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

REPO_NAME = "getsentry/sentry"
RUN_STATE_ID = 4242


def _pr(pr_number: int = 42, repo_name: str = REPO_NAME) -> dict[str, Any]:
    return {
        "provider": "unknown",
        "repo_name": repo_name,
        "pull_request": {"pr_number": pr_number, "pr_url": f"https://x/{pr_number}"},
    }


class LinkSeerRunToPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_STATE_ID
        )

    def _link(self, run_id: int = RUN_STATE_ID) -> None:
        link_seer_run_to_pull_requests(
            organization=self.organization, pull_requests=[_pr()], run_id=run_id
        )

    def test_links_pull_request_to_seer_run(self) -> None:
        self._link()

        pr = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert SeerRunPullRequest.objects.get(pull_request=pr).seer_run_id == self.seer_run.id

    def test_no_links_when_run_not_found(self) -> None:
        self._link(run_id=999999)

        assert not SeerRunPullRequest.objects.exists()

    def test_is_idempotent_on_redelivery(self) -> None:
        self._link()
        self._link()

        pr = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert SeerRunPullRequest.objects.filter(pull_request=pr).count() == 1

    def test_links_multiple_prs_for_one_run(self) -> None:
        """A multi-repo run links each opened PR to the same run."""
        other_repo = self.create_repo(
            self.project, name="getsentry/other", provider="integrations:github"
        )

        link_seer_run_to_pull_requests(
            organization=self.organization,
            pull_requests=[_pr(pr_number=1), _pr(pr_number=2, repo_name="getsentry/other")],
            run_id=RUN_STATE_ID,
        )

        pr1 = PullRequest.objects.get(repository_id=self.repo.id, key="1")
        pr2 = PullRequest.objects.get(repository_id=other_repo.id, key="2")
        assert SeerRunPullRequest.objects.filter(seer_run=self.seer_run).count() == 2
        assert SeerRunPullRequest.objects.filter(pull_request=pr1).exists()
        assert SeerRunPullRequest.objects.filter(pull_request=pr2).exists()

    def test_one_failing_entry_does_not_drop_the_rest(self) -> None:
        other_repo = self.create_repo(
            self.project, name="getsentry/other", provider="integrations:github"
        )

        # First entry raises mid-resolve; the second must still get linked.
        seen: list[str] = []

        def flaky(**kwargs):
            seen.append(kwargs["repo_name"])
            if len(seen) == 1:
                raise RuntimeError("boom")
            return get_or_create_seer_pull_request(**kwargs)

        with patch("sentry.seer.pull_requests.get_or_create_seer_pull_request", side_effect=flaky):
            link_seer_run_to_pull_requests(
                organization=self.organization,
                pull_requests=[_pr(pr_number=1), _pr(pr_number=2, repo_name="getsentry/other")],
                run_id=RUN_STATE_ID,
            )

        assert not PullRequest.objects.filter(key="1").exists()
        pr2 = PullRequest.objects.get(repository_id=other_repo.id, key="2")
        assert SeerRunPullRequest.objects.filter(pull_request=pr2).exists()


class MaybeLinkSeerRunToPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_STATE_ID)

    def _maybe_link(self) -> None:
        maybe_link_seer_run_to_pull_requests(
            organization=self.organization, pull_requests=[_pr()], run_id=RUN_STATE_ID
        )

    def test_killswitch_skips_linking(self) -> None:
        with override_options({"seer.run-pr-link.killswitch.enabled": True}):
            self._maybe_link()

        assert not SeerRunPullRequest.objects.exists()

    def test_swallows_exceptions(self) -> None:
        with patch(
            "sentry.seer.pull_requests.link_seer_run_to_pull_requests",
            side_effect=RuntimeError("boom"),
        ):
            self._maybe_link()  # must not raise
