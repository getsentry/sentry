from __future__ import annotations

from typing import Any

import pytest

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.pull_request import PullRequestLifecycleHandler
from sentry.integrations.cursor_origin.webhook import HANDLERS
from sentry.integrations.cursor_origin.webhook_types import OriginPayloadError, PullRequestEvent
from sentry.integrations.services.integration import integration_service
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"
REPO_EXTERNAL_ID = "r_01example"
DELIVERY_ID = "whd_01example"


def _payload(**overrides: Any) -> dict[str, Any]:
    pull_request: dict[str, Any] = {
        "id": "pr_01example",
        "number": "17",
        "state": "open",
        "draft": False,
        "merged": False,
        "title": "Add launch telemetry",
        "body": "Adds structured launch telemetry.",
        "head": {"ref": "add-telemetry", "sha": "9a41f0c3"},
        "base": {"ref": "main", "sha": "3b1f9c2d"},
        "author": {"user": {"id": "user_01example", "email": "jane@example.com"}},
        "createdAt": "2026-08-01T09:30:00Z",
        "updatedAt": "2026-08-01T10:00:00Z",
    }
    pull_request.update(overrides)
    return {
        "pullRequest": pull_request,
        "repository": {"id": REPO_EXTERNAL_ID, "name": "rocket"},
    }


@cell_silo_test
class PullRequestLifecycleHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            provider="integrations:cursor_origin",
            integration_id=self.integration.id,
            external_id=REPO_EXTERNAL_ID,
            config={"name": REPO},
        )
        context = integration_service.organization_contexts(
            provider="cursor_origin", external_id=INSTALLATION_ID
        )
        assert context.integration is not None
        self.rpc_integration = context.integration
        self.org_integrations = context.organization_integrations

    def _handle(self, payload: dict[str, Any], event_type: str = "pull_request.created") -> None:
        PullRequestLifecycleHandler(event_type)(
            payload, DELIVERY_ID, self.rpc_integration, self.org_integrations
        )

    def _pull_requests(self) -> list[PullRequest]:
        return list(PullRequest.objects.filter(repository_id=self.repo.id).order_by("key"))

    def test_an_opened_pull_request_is_recorded(self) -> None:
        self._handle(_payload())

        pull_request = self._pull_requests()[0]
        assert pull_request.key == "17"
        assert pull_request.external_id == "pr_01example"
        assert pull_request.title == "Add launch telemetry"
        assert pull_request.message == "Adds structured launch telemetry."
        assert pull_request.state == PullRequestLifecycleState.OPEN
        assert pull_request.head_commit_sha == "9a41f0c3"
        assert pull_request.author is not None
        assert pull_request.author.email == "jane@example.com"

    def test_a_merge_is_stored_as_merged_rather_than_closed(self) -> None:
        """Origin reports a merged pull request as closed with a separate flag."""
        self._handle(
            _payload(
                state="closed",
                merged=True,
                mergeCommitSha="ffff0000",
                closedAt="2026-08-02T09:30:00Z",
                mergedAt="2026-08-02T09:30:00Z",
                updatedAt="2026-08-02T09:30:00Z",
            )
        )

        pull_request = self._pull_requests()[0]
        assert pull_request.state == PullRequestLifecycleState.MERGED
        assert pull_request.merge_commit_sha == "ffff0000"
        assert pull_request.merged_at is not None

    def test_a_close_without_a_merge_is_stored_as_closed(self) -> None:
        self._handle(
            _payload(
                state="closed", closedAt="2026-08-02T09:30:00Z", updatedAt="2026-08-02T09:30:00Z"
            )
        )

        assert self._pull_requests()[0].state == PullRequestLifecycleState.CLOSED

    def test_empty_close_and_merge_fields_are_unset(self) -> None:
        self._handle(_payload(closedAt="", mergedAt="", mergeCommitSha=""))

        pull_request = self._pull_requests()[0]
        assert pull_request.closed_at is None
        assert pull_request.merged_at is None
        assert pull_request.merge_commit_sha is None

    def test_a_later_event_updates_the_same_row(self) -> None:
        self._handle(_payload())
        self._handle(
            _payload(title="Add launch telemetry, take two", updatedAt="2026-08-01T11:00:00Z")
        )

        pull_requests = self._pull_requests()
        assert len(pull_requests) == 1
        assert pull_requests[0].title == "Add launch telemetry, take two"

    def test_a_push_to_the_head_branch_moves_the_head_commit(self) -> None:
        """`head_ref.pushed` carries the same snapshot, with the new tip."""
        self._handle(_payload())
        self._handle(
            _payload(
                head={"ref": "add-telemetry", "sha": "c0ffee00"}, updatedAt="2026-08-01T11:00:00Z"
            )
        )

        assert self._pull_requests()[0].head_commit_sha == "c0ffee00"

    def test_every_lifecycle_event_is_routed_to_the_handler(self) -> None:
        """Origin sends the whole pull request with each of these, so one handler serves all."""
        routed = sorted(
            event for event, handler in HANDLERS.items() if handler is PullRequestLifecycleHandler
        )

        assert routed == [
            "pull_request.base_ref.updated",
            "pull_request.closed",
            "pull_request.created",
            "pull_request.head_ref.pushed",
            "pull_request.merged",
            "pull_request.metadata.updated",
            "pull_request.published",
            "pull_request.reopened",
        ]

    def test_a_stale_snapshot_is_dropped(self) -> None:
        """Deliveries can arrive out of order, so the shared upsert compares timestamps."""
        self._handle(
            _payload(
                state="closed",
                merged=True,
                mergedAt="2026-08-02T09:30:00Z",
                closedAt="2026-08-02T09:30:00Z",
                updatedAt="2026-08-02T09:30:00Z",
            )
        )
        self._handle(_payload(updatedAt="2026-08-01T10:00:00Z"))

        assert self._pull_requests()[0].state == PullRequestLifecycleState.MERGED

    def test_a_draft_is_recorded_as_open(self) -> None:
        self._handle(_payload(draft=True))

        pull_request = self._pull_requests()[0]
        assert pull_request.draft is True
        assert pull_request.state == PullRequestLifecycleState.OPEN

    def test_an_app_author_is_kept_under_a_localhost_email(self) -> None:
        payload = _payload()
        payload["pullRequest"]["author"] = {"app": {"id": "app_01example", "displayName": "Sentry"}}

        self._handle(payload)

        author = self._pull_requests()[0].author
        assert author is not None
        assert (author.email, author.name) == ("app_01example@localhost", "Sentry")

    def test_a_service_account_author_is_named_by_its_id(self) -> None:
        payload = _payload()
        payload["pullRequest"]["author"] = {"serviceAccount": {"id": "sa_01example"}}

        self._handle(payload)

        author = self._pull_requests()[0].author
        assert author is not None
        assert (author.email, author.name) == ("sa_01example@localhost", "sa_01example")

    def test_an_unknown_repository_is_ignored(self) -> None:
        payload = _payload()
        payload["repository"]["id"] = "r_01nope"

        self._handle(payload)

        assert self._pull_requests() == []


class PullRequestEventTest(TestCase):
    def test_an_open_pull_request_has_no_close_date(self) -> None:
        """Origin leaves `closedAt` out while the pull request is open."""
        assert PullRequestEvent.from_payload(_payload()).pull_request.closed_at is None

    def test_a_field_origin_always_sends_is_required(self) -> None:
        payload = _payload()
        del payload["pullRequest"]["title"]

        with pytest.raises(OriginPayloadError, match="pullRequest -> title"):
            PullRequestEvent.from_payload(payload)

    def test_a_state_origin_does_not_document_is_refused(self) -> None:
        with pytest.raises(OriginPayloadError, match="pullRequest -> state"):
            PullRequestEvent.from_payload(_payload(state="locked"))

    def test_an_author_display_name_is_kept_when_origin_sends_one(self) -> None:
        payload = _payload()
        payload["pullRequest"]["author"]["user"]["displayName"] = "Jane Roe"

        user = PullRequestEvent.from_payload(payload).pull_request.author.user

        assert user is not None
        assert user.display_name == "Jane Roe"
