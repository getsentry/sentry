from typing import Any
from unittest.mock import Mock, patch

from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest, ResolvedPullRequest
from sentry.seer.pull_requests import resolve_seer_created_pull_requests
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"


def _warning_events(mock_logger: Mock) -> list[str]:
    return [call.args[0] for call in mock_logger.warning.call_args_list]


class ResolveSeerCreatedPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")

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

    def _resolve(
        self, pull_requests: list[dict[str, Any]], *, organization: Organization | None = None
    ) -> list[tuple[int, str | None]]:
        org = organization or self.organization
        resolved = resolve_seer_created_pull_requests(
            organization_id=org.id,
            pull_requests=pull_requests,
            log_context={"organization_id": org.id},
        )
        return [(pr.pull_request.id, pr.pr_url) for pr in resolved]

    def test_resolves_reported_pull_request(self) -> None:
        resolved = self._resolve(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert pull_request.organization_id == self.organization.id
        assert resolved == [(pull_request.id, "https://github.com/getsentry/sentry/pull/42")]

    def test_find_or_create_is_idempotent(self) -> None:
        self._resolve(self._payload())
        self._resolve(self._payload())

        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").count() == 1

    def test_reuses_existing_pull_request(self) -> None:
        existing = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
            title="Pre-existing from SCM webhook",
        )

        resolved = self._resolve(self._payload())

        existing.refresh_from_db()
        # The find-or-create must not clobber fields set by the SCM webhook.
        assert existing.title == "Pre-existing from SCM webhook"
        assert resolved == [(existing.id, "https://github.com/getsentry/sentry/pull/42")]

    def test_skips_and_warns_when_repository_not_found(self) -> None:
        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            resolved = self._resolve(
                [
                    {
                        "provider": "github",
                        "repo_name": "getsentry/does-not-exist",
                        "pull_request": {"pr_id": 1, "pr_number": 7, "pr_url": "https://x/7"},
                    }
                ]
            )

        assert resolved == []
        assert not PullRequest.objects.filter(repository_id=self.repo.id).exists()
        assert "seer.pr_resolution.repo_not_found" in _warning_events(mock_logger)

    def test_resolves_against_the_given_org_only(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(other_project, name=REPO_NAME, provider="integrations:github")

        self._resolve(self._payload(), organization=other_org)

        # Resolved against the other org's repo, never this org's same-named repo.
        assert not PullRequest.objects.filter(repository_id=self.repo.id).exists()
        assert PullRequest.objects.filter(repository_id=other_repo.id).exists()

    def test_resolves_by_provider_when_name_collides(self) -> None:
        gitlab_repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        self._resolve(self._payload(provider="github"))

        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()
        assert not PullRequest.objects.filter(repository_id=gitlab_repo.id).exists()

    def test_resolves_unknown_provider_when_unambiguous(self) -> None:
        self._resolve(self._payload(provider="unknown"))

        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()

    def test_treats_uppercase_unknown_as_sentinel(self) -> None:
        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            self._resolve(self._payload(provider="UNKNOWN"))

        # "UNKNOWN" must be treated as the unknown sentinel, not a real provider:
        # the single same-named repo resolves and no unrecognized warning fires.
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()
        assert "seer.pr_resolution.unrecognized_provider" not in _warning_events(mock_logger)

    def test_skips_unknown_provider_when_ambiguous(self) -> None:
        self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            resolved = self._resolve(self._payload(provider="unknown"))

        # Two same-named repos under different providers — refuse to guess, warn.
        assert resolved == []
        assert not PullRequest.objects.exists()
        assert "seer.pr_resolution.repo_ambiguous" in _warning_events(mock_logger)

    def test_warns_on_unrecognized_provider(self) -> None:
        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            self._resolve(self._payload(provider="subversion"))

        # An unmapped provider is flagged so it can be fixed upstream in Seer.
        assert "seer.pr_resolution.unrecognized_provider" in _warning_events(mock_logger)

    def test_one_entry_failure_does_not_drop_the_batch(self) -> None:
        good_pr = self.create_pull_request(
            organization_id=self.organization.id, repository_id=self.repo.id, key="2"
        )
        payload = self._payload(pr_number=1) + self._payload(pr_number=2)

        with (
            patch(
                "sentry.seer.pull_requests.PullRequest.objects.get_or_create_from_reference",
                side_effect=[RuntimeError("boom"), ResolvedPullRequest(good_pr, "resolved", False)],
            ),
            patch("sentry.seer.pull_requests.logger") as mock_logger,
        ):
            resolved = self._resolve(payload)

        # The second entry is still resolved after the first one raises.
        assert resolved == [(good_pr.id, "https://github.com/getsentry/sentry/pull/42")]
        exception_events = [call.args[0] for call in mock_logger.exception.call_args_list]
        assert "seer.pr_resolution.failed" in exception_events

    def test_skips_entries_missing_fields(self) -> None:
        with patch("sentry.seer.pull_requests.logger") as mock_logger:
            resolved = self._resolve(
                [
                    {"provider": "unknown", "pull_request": {"pr_number": 1}},  # no repo_name
                    {
                        "provider": "unknown",
                        "repo_name": REPO_NAME,
                        "pull_request": {},
                    },  # no pr_number
                ]
            )

        assert resolved == []
        assert "seer.pr_resolution.missing_fields" in _warning_events(mock_logger)
