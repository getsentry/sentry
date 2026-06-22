from typing import Any
from unittest.mock import Mock, patch

from sentry.models.pullrequest import PullRequest
from sentry.seer.models.run import SeerRunPullRequest
from sentry.seer.pr_links import link_seer_run_to_pull_requests
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"
RUN_STATE_ID = 4242


def _warning_events(mock_logger: Mock) -> list[str]:
    return [call.args[0] for call in mock_logger.warning.call_args_list]


class LinkSeerRunToPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")

    def _payload(
        self,
        pr_number: int = 42,
        provider: str = "unknown",
        repo_name: str = REPO_NAME,
    ) -> list[dict[str, Any]]:
        return [
            {
                "provider": provider,
                "repo_name": repo_name,
                "pull_request": {
                    "pr_id": 999,
                    "pr_number": pr_number,
                    "pr_url": f"https://github.com/getsentry/sentry/pull/{pr_number}",
                },
            }
        ]

    def _link(self, pull_requests: list[dict[str, Any]], *, run_id: int = RUN_STATE_ID) -> None:
        link_seer_run_to_pull_requests(
            organization=self.organization,
            pull_requests=pull_requests,
            run_id=run_id,
        )

    def test_links_pull_request_to_existing_seer_run(self) -> None:
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_STATE_ID)

        self._link(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_state_id == RUN_STATE_ID
        assert link.seer_run_id == run.id

    def test_links_with_null_run_when_mirror_absent(self) -> None:
        # The SeerRun mirror is outbox-backed and may not exist yet.
        self._link(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_state_id == RUN_STATE_ID
        assert link.seer_run_id is None

    def test_does_not_attach_seer_run_from_another_org(self) -> None:
        other_org = self.create_organization()
        self.create_seer_run(organization=other_org, seer_run_state_id=RUN_STATE_ID)

        self._link(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id is None

    def test_reuses_canonical_pull_request_row(self) -> None:
        existing = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
            title="Pre-existing from SCM webhook",
        )

        self._link(self._payload())

        # Find-or-create must not clobber fields set by the SCM webhook or create
        # a second row for the same PR.
        existing.refresh_from_db()
        assert existing.title == "Pre-existing from SCM webhook"
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").count() == 1
        assert SeerRunPullRequest.objects.filter(pull_request=existing).count() == 1

    def test_is_idempotent_on_redelivery(self) -> None:
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_STATE_ID)

        self._link(self._payload())
        self._link(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert SeerRunPullRequest.objects.filter(pull_request=pull_request).count() == 1

    def test_links_multiple_pull_requests_for_one_run(self) -> None:
        other_repo = self.create_repo(
            self.project, name="getsentry/seer", provider="integrations:github"
        )

        self._link(
            [
                *self._payload(pr_number=1),
                *self._payload(pr_number=2, repo_name="getsentry/seer"),
            ]
        )

        pr1 = PullRequest.objects.get(repository_id=self.repo.id, key="1")
        pr2 = PullRequest.objects.get(repository_id=other_repo.id, key="2")
        assert SeerRunPullRequest.objects.filter(seer_run_state_id=RUN_STATE_ID).count() == 2
        assert SeerRunPullRequest.objects.filter(pull_request=pr1).exists()
        assert SeerRunPullRequest.objects.filter(pull_request=pr2).exists()

    def test_skips_and_warns_when_repository_not_found(self) -> None:
        with patch("sentry.seer.pr_links.logger") as mock_logger:
            self._link(self._payload(repo_name="getsentry/does-not-exist"))

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.repo_unresolved" in _warning_events(mock_logger)

    def test_skips_other_orgs_repository(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(other_project, name=REPO_NAME, provider="integrations:github")

        link_seer_run_to_pull_requests(
            organization=other_org, pull_requests=self._payload(), run_id=RUN_STATE_ID
        )

        # Resolved against the other org's repo, never this org's same-named repo.
        assert not PullRequest.objects.filter(repository_id=self.repo.id).exists()
        assert SeerRunPullRequest.objects.filter(pull_request__repository_id=other_repo.id).exists()

    def test_skips_when_repo_name_ambiguous(self) -> None:
        # Two same-named repos under different providers, payload provider unknown.
        self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        with patch("sentry.seer.pr_links.logger") as mock_logger:
            self._link(self._payload(provider="unknown"))

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.repo_unresolved" in _warning_events(mock_logger)

    def test_disambiguates_by_provider(self) -> None:
        gitlab_repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        self._link(self._payload(provider="github"))

        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()
        assert not PullRequest.objects.filter(repository_id=gitlab_repo.id).exists()

    def test_skips_entries_missing_fields(self) -> None:
        with patch("sentry.seer.pr_links.logger") as mock_logger:
            self._link(
                [
                    {"provider": "unknown", "pull_request": {"pr_number": 1}},  # no repo_name
                    {
                        "provider": "unknown",
                        "repo_name": REPO_NAME,
                        "pull_request": {},
                    },  # no number
                ]
            )

        assert not SeerRunPullRequest.objects.exists()
        assert _warning_events(mock_logger).count("seer.pr_link.missing_fields") == 2

    def test_one_entry_failure_does_not_drop_the_batch(self) -> None:
        self.create_repo(self.project, name="getsentry/seer", provider="integrations:github")

        with (
            patch(
                "sentry.seer.pr_links.PullRequest.objects.get_or_create",
                side_effect=[RuntimeError("boom"), (Mock(id=1), True)],
            ),
            patch("sentry.seer.pr_links.SeerRunPullRequest.objects.get_or_create") as mock_link,
            patch("sentry.seer.pr_links.logger") as mock_logger,
        ):
            self._link(
                [
                    *self._payload(pr_number=1),
                    *self._payload(pr_number=2, repo_name="getsentry/seer"),
                ]
            )

        # The second entry is still attempted after the first one raises.
        assert mock_link.call_count == 1
        exception_events = [call.args[0] for call in mock_logger.exception.call_args_list]
        assert "seer.pr_link.failed" in exception_events
