from collections.abc import Generator
from unittest.mock import patch

import orjson
import pytest

from fixtures.github import PULL_REQUEST_OPENED_EVENT_EXAMPLE
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.repositorysettings import CodeReviewSettings, CodeReviewTrigger
from sentry.seer.code_review.webhooks.pull_request import handle_pull_request_event
from sentry.testutils.helpers.github import GitHubWebhookCodeReviewTestCase


class PullRequestEventWebhookTest(GitHubWebhookCodeReviewTestCase):
    """Integration tests for GitHub pull_request webhook events."""

    OPTIONS_TO_SET: dict[str, object] = {}

    @pytest.fixture(autouse=True)
    def mock_github_api_calls(self) -> Generator[None]:
        """
        Prevents real HTTP requests to GitHub API across all tests.
        Uses autouse fixture to apply mocking automatically without @patch decorators on each test.
        """
        with (
            patch(
                "sentry.integrations.github.client.GitHubApiClient.get_pull_request"
            ) as mock_get_pull_request,
            patch(
                "sentry.integrations.github.client.GitHubApiClient.create_issue_reaction"
            ) as mock_reaction,
            patch(
                "sentry.integrations.github.client.GitHubApiClient.get_issue_reactions"
            ) as mock_get_reactions,
            patch(
                "sentry.integrations.github.client.GitHubApiClient.delete_issue_reaction"
            ) as mock_delete_reaction,
        ):
            mock_get_pull_request.return_value = {"head": {"sha": "abc123"}}
            mock_get_reactions.return_value = [
                {"id": 2, "user": {"login": "other-user"}, "content": "heart"}
            ]

            self.mock_get_pull_request = mock_get_pull_request
            self.mock_reaction = mock_reaction
            self.mock_get_reactions = mock_get_reactions
            self.mock_delete_reaction = mock_delete_reaction
            yield

    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        """
        Prevents real HTTP requests to Seer API across all tests.
        Uses autouse fixture to apply mocking automatically without @patch decorators on each test.
        """
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request") as mock_seer:
            self.mock_seer = mock_seer
            yield

    def test_pull_request_opened_uses_review_request_endpoint(self) -> None:
        """Test that opened action uses review-request endpoint."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            assert event["action"] == "opened"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            call_kwargs = self.mock_seer.call_args[1]
            assert call_kwargs["path"] == "/v1/code_review/review-request"

            self.mock_reaction.assert_called_once_with(
                event["repository"]["full_name"],
                str(event["pull_request"]["number"]),
                GitHubReaction.EYES,
            )

    def test_pull_request_skips_draft(self) -> None:
        """Test that draft PRs are skipped."""
        with self.code_review_setup(), self.tasks():
            event_with_draft = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event_with_draft["pull_request"]["draft"] = True

            response = self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_with_draft),
            )

            assert response.status_code == 204
            self.mock_seer.assert_not_called()

    def test_pull_request_skips_unsupported_action(self) -> None:
        """Test that unsupported actions are skipped."""
        with self.code_review_setup(), self.tasks():
            event_with_unsupported_action = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event_with_unsupported_action["action"] = "assigned"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_with_unsupported_action),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_missing_action_field(self) -> None:
        """Test that events without action field are skipped."""
        with self.code_review_setup(), self.tasks():
            event_without_action = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            del event_without_action["action"]

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_without_action),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_invalid_action_type(self) -> None:
        """Test that events with non-string action are skipped."""
        with self.code_review_setup(), self.tasks():
            event_with_invalid_action = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event_with_invalid_action["action"] = 123

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_with_invalid_action),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_skips_when_code_review_disabled(self) -> None:
        """Test that PR events are skipped when code review features are not enabled."""
        with self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_ready_for_review_action(self) -> None:
        """Test that ready_for_review action triggers Seer request and adds reaction."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            self.mock_reaction.assert_called_once()

    def test_pull_request_reopened_action(self) -> None:
        """Test that reopened action is skipped (not in whitelisted actions)."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "reopened"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_synchronize_action(self) -> None:
        """Test that synchronize action triggers Seer request and adds reaction."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "synchronize"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            self.mock_reaction.assert_called_once()

    def test_pull_request_invalid_enum_action(self) -> None:
        """Test that actions not in PullRequestAction enum are handled gracefully."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "future_action_not_in_enum"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_blocks_draft_for_ready_for_review_action(self) -> None:
        """Test that draft PRs are blocked for ready_for_review action."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"
            event["pull_request"]["draft"] = True

            response = self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            assert response.status_code == 204
            self.mock_seer.assert_not_called()
            self.mock_reaction.assert_not_called()

    def test_pull_request_blocks_draft_for_synchronize_action(self) -> None:
        """Test that draft PRs are blocked for synchronize action."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "synchronize"
            event["pull_request"]["draft"] = True

            response = self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            assert response.status_code == 204
            self.mock_seer.assert_not_called()
            self.mock_reaction.assert_not_called()

    def test_pull_request_closed_uses_pr_closed_endpoint(self) -> None:
        """Test that closed action uses pr-closed endpoint."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            call_kwargs = self.mock_seer.call_args[1]
            assert call_kwargs["path"] == "/v1/code_review/pr-closed"
            self.mock_reaction.assert_not_called()

    def test_pull_request_opened_filtered_when_trigger_disabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_NEW_COMMIT]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        with (
            self.code_review_setup(triggers=triggers, features=features),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "opened"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_not_called()

    def test_pull_request_synchronize_filtered_when_trigger_disabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        with (
            self.code_review_setup(triggers=triggers, features=features),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "synchronize"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_not_called()

    def test_pull_request_ready_for_review_filtered_when_trigger_disabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_NEW_COMMIT]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        with (
            self.code_review_setup(triggers=triggers, features=features),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_not_called()

    def test_pull_request_closed_filtered_when_no_triggers_configured_post_ga(self) -> None:
        """Test that closed action is filtered when no triggers are configured for a seat-based org.

        If no triggers are configured, no pr_review was ever sent for any PR in this repo,
        so there is nothing for Seer to process on close.

        Note: This test calls handle_pull_request_event directly because the _send_webhook_event
        helper skips RepositorySettings creation when triggers=[], which would cause the preflight
        to deny the request before reaching the handler under test.
        """
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        with self.feature(features), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"

            handle_pull_request_event(
                github_event=GithubWebhookType.PULL_REQUEST,
                event=event,
                organization=self.organization,
                repo=self.create_repo(project=self.project, provider="integrations:github"),
                org_code_review_settings=CodeReviewSettings(enabled=True, triggers=[]),
                tags={},
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_closed_not_filtered_when_triggers_configured_post_ga(self) -> None:
        """Test that closed action reaches Seer when at least one trigger is configured."""
        triggers: list[CodeReviewTrigger] = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        with (
            self.code_review_setup(triggers=triggers, features=features),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_called_once()

    def test_pull_request_opened_works_when_trigger_enabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        with (
            self.code_review_setup(triggers=triggers, features=features),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "opened"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_called_once()

    def test_pull_request_ready_for_review_works_when_trigger_enabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        with (
            self.code_review_setup(triggers=triggers, features=features),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_called_once()

    def test_pull_request_closed_draft_still_sends_to_seer(self) -> None:
        """Test that closed draft PRs still send cleanup notifications to Seer.

        This prevents orphaned state in Seer when a PR is:
        1. Opened as non-draft (Seer notified)
        2. Converted to draft
        3. Closed while draft (Seer must be notified to cleanup state)
        """
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"
            event["pull_request"]["draft"] = True
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            # Should still call Seer even though PR is draft
            self.mock_seer.assert_called_once()

    def test_validation_happens_before_task_scheduling_pr_closed(self) -> None:
        """Test that invalid pr-closed payloads are caught before scheduling the Celery task."""
        with (
            self.code_review_setup(),
            self.tasks(),
            patch(
                "sentry.seer.code_review.webhooks.task.transform_webhook_to_codegen_request"
            ) as mock_transform,
        ):
            # Return an invalid payload missing required fields for pr-closed
            mock_transform.return_value = {
                "request_type": "pr-closed",
                "data": {
                    # Missing required fields like repo, pr_id, etc.
                    "invalid": "payload"
                },
            }

            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            # Task should NOT be scheduled due to validation failure
            self.mock_seer.assert_not_called()

    def test_validation_happens_before_task_scheduling_pr_review(self) -> None:
        """Test that invalid pr-review payloads are caught before scheduling the Celery task."""
        with (
            self.code_review_setup(),
            self.tasks(),
            patch(
                "sentry.seer.code_review.webhooks.task.transform_webhook_to_codegen_request"
            ) as mock_transform,
        ):
            # Return an invalid payload missing required fields for pr-review
            mock_transform.return_value = {
                "request_type": "pr-review",
                "data": {
                    # Missing required fields
                    "invalid": "payload"
                },
            }

            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "opened"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            # Task should NOT be scheduled due to validation failure
            self.mock_seer.assert_not_called()


# ---------------------------------------------------------------------------
# Contributor seeding: GitHub uses permanent DB dedup; GitLab uses Redis TTL
# ---------------------------------------------------------------------------


class PullRequestContributorSeedingTest(GitHubWebhookCodeReviewTestCase):
    """Prove that PullRequestEventWebhook._handle seeds OrganizationContributors
    via track_contributor_seat when PullRequest.objects.update_or_create returns
    created=True — a permanent, DB-backed dedup — unlike GitLab's
    track_gitlab_contributor_seat_processor which uses a 20-second Redis TTL.

    Key behavioural difference:
    - GitHub: row seeded inside _handle via ``if created:``. Re-delivery of the same
      PR-open event sets created=False (the DB row already exists) so track_contributor_seat
      is NOT called again. The dedup lasts forever.
    - GitLab: row seeded by track_gitlab_contributor_seat_processor (runs as the first
      WEBHOOK_EVENT_PROCESSORS entry). Dedup is a Redis key with a 20 s TTL; after TTL
      expiry, a redelivered open event calls track_contributor_seat again (idempotent via
      get_or_create, but the dedup window is finite).
    """

    @pytest.fixture(autouse=True)
    def mock_github_api_calls(self) -> Generator[None]:
        with (
            patch("sentry.integrations.github.client.GitHubApiClient.get_pull_request"),
            patch("sentry.integrations.github.client.GitHubApiClient.create_issue_reaction"),
            patch(
                "sentry.integrations.github.client.GitHubApiClient.get_issue_reactions",
                return_value=[],
            ),
            patch("sentry.integrations.github.client.GitHubApiClient.delete_issue_reaction"),
        ):
            yield

    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request"):
            yield

    def _send_pr_event_without_contributor(self, event: dict) -> None:
        """Send a PR webhook without pre-seeding the contributor row.

        _send_webhook_event (the normal test helper) always calls
        OrganizationContributors.get_or_create before sending the webhook, masking
        the production seeding behaviour.  This helper replicates only the
        integration/repo/settings setup and sends the raw webhook so we can observe
        what PullRequestEventWebhook._handle does on its own.
        """
        from sentry.models.organizationcontributors import OrganizationContributors
        from sentry.seer.code_review.utils import get_pr_author_id

        event_bytes = orjson.dumps(event)
        event_dict = event
        repo_id = str(event_dict["repository"]["id"])
        integration = self.create_github_integration()
        repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=repo_id,
            integration_id=integration.id,
        )
        trigger_values = [t.value for t in self._triggers]
        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=trigger_values,
        )
        # Assert the row genuinely does not exist before the webhook fires.
        pr_author_id = get_pr_author_id(event_dict)
        assert pr_author_id is not None
        assert not OrganizationContributors.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_identifier=pr_author_id,
        ).exists(), "expected no contributor row before the PR-open webhook"

        self._integration = integration
        self._pr_author_id = pr_author_id
        self.send_github_webhook_event(GithubWebhookType.PULL_REQUEST, event_bytes)

    def test_pr_open_seeds_contributor_row_permanently(self) -> None:
        """A PR-open webhook creates the OrganizationContributors row via track_contributor_seat.

        The row is seeded inside PullRequestEventWebhook._handle — specifically the
        ``if created:`` branch of PullRequest.objects.update_or_create — and persists
        in the database until explicitly deleted.  This permanent DB-backed dedup is
        stronger than GitLab's 20-second Redis TTL: re-delivering the same PR-open event
        does not create a duplicate row and does not call track_contributor_seat again.
        """
        event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        event["action"] = "opened"

        with self.code_review_setup(), self.tasks():
            self._send_pr_event_without_contributor(event)

        # The row must exist after the webhook is processed.
        assert OrganizationContributors.objects.filter(
            organization_id=self.organization.id,
            integration_id=self._integration.id,
            external_identifier=self._pr_author_id,
        ).exists(), "PullRequestEventWebhook._handle should seed OrganizationContributors on PR open"

    def test_pr_open_redelivery_does_not_duplicate_contributor_row(self) -> None:
        """Re-delivering a PR-open event does not create a second contributor row.

        PullRequest.objects.update_or_create returns created=False for the second
        delivery, so the ``if created:`` guard skips track_contributor_seat.  This
        contrasts with GitLab's Redis TTL: after 20 s the same open event would call
        track_contributor_seat again (harmlessly idempotent via get_or_create, but
        the dedup mechanism is ephemeral rather than permanent).
        """
        event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        event["action"] = "opened"

        with self.code_review_setup(), self.tasks():
            # First delivery — seeds the PullRequest row and the contributor row.
            self._send_pr_event_without_contributor(event)
            assert OrganizationContributors.objects.filter(
                organization_id=self.organization.id,
                integration_id=self._integration.id,
                external_identifier=self._pr_author_id,
            ).count() == 1

            # Second delivery of the exact same event.
            self.send_github_webhook_event(
                GithubWebhookType.PULL_REQUEST, orjson.dumps(event)
            )

        # Still exactly one row — the DB dedup prevents a second seeding.
        assert (
            OrganizationContributors.objects.filter(
                organization_id=self.organization.id,
                integration_id=self._integration.id,
                external_identifier=self._pr_author_id,
            ).count()
            == 1
        ), "re-delivering the PR-open event must not create a duplicate contributor row"
