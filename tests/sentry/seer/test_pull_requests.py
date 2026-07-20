from typing import Any
from unittest.mock import Mock, patch

from sentry.models.pullrequest import PullRequest
from sentry.seer.models.run import SeerRun, SeerRunPullRequest, SeerRunType
from sentry.seer.pull_requests import link_seer_run_pull_requests
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"
RUN_STATE_ID = 123


def _warning_events(mock_logger: Mock) -> list[str]:
    return [call.args[0] for call in mock_logger.warning.call_args_list]


class LinkSeerRunPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=RUN_STATE_ID
        )

    def _payload(
        self,
        pr_number: int = 42,
        pr_url: str = "https://github.com/getsentry/sentry/pull/42",
        provider: str = "github",
    ) -> list[dict[str, Any]]:
        return [
            {
                "provider": provider,
                "repo_name": REPO_NAME,
                "pull_request": {"pr_id": 999, "pr_number": pr_number, "pr_url": pr_url},
            }
        ]

    def _link(
        self,
        pull_requests: list[dict[str, Any]],
        *,
        seer_run_state_id: int | None = RUN_STATE_ID,
    ) -> None:
        link_seer_run_pull_requests(
            organization=self.organization,
            seer_run_state_id=seer_run_state_id,
            pull_requests=pull_requests,
        )

    def test_creates_link_and_resolves_pull_request(self) -> None:
        self._link(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id == self.seer_run.id
        assert list(self.seer_run.pull_requests) == [pull_request]

    def test_first_run_keeps_pull_request(self) -> None:
        self._link(self._payload())

        other_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=456
        )
        link_seer_run_pull_requests(
            organization=self.organization,
            seer_run_state_id=456,
            pull_requests=self._payload(),
        )

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id == self.seer_run.id
        assert link.seer_run_id != other_run.id

    def test_links_multiple_pull_requests(self) -> None:
        self._link(self._payload() + self._payload(pr_number=43))

        assert SeerRunPullRequest.objects.filter(seer_run=self.seer_run).count() == 2

    def test_noop_when_run_id_missing(self) -> None:
        self._link(self._payload(), seer_run_state_id=None)
        assert not SeerRunPullRequest.objects.exists()

    @patch("sentry.seer.pull_requests.logger")
    def test_missing_fields_skipped(self, mock_logger: Mock) -> None:
        self._link([{"provider": "github", "pull_request": {"pr_number": None}}])

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.missing_fields" in _warning_events(mock_logger)

    @patch("sentry.seer.pull_requests.logger")
    def test_unresolvable_repo_skipped(self, mock_logger: Mock) -> None:
        self._link(
            [
                {
                    "provider": "github",
                    "repo_name": "getsentry/does-not-exist",
                    "pull_request": {"pr_number": 42},
                }
            ]
        )

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.repo_unresolved" in _warning_events(mock_logger)

    @patch("sentry.seer.pull_requests.options.get", return_value=True)
    def test_killswitch_disables_writes(self, mock_option: Mock) -> None:
        self._link(self._payload())

        mock_option.assert_called_once_with("seer.pull-request-linking.killswitch.enabled")
        assert not SeerRunPullRequest.objects.exists()
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()

    def test_run_lookup_is_org_scoped(self) -> None:
        """A run id that exists only in another org must not link here."""
        other_org = self.create_organization()
        SeerRun.objects.filter(id=self.seer_run.id).update(organization=other_org)

        self._link(self._payload())

        assert not SeerRunPullRequest.objects.exists()
