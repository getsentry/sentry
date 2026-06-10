from typing import Any
from unittest.mock import patch

import orjson

from fixtures.gitlab import MERGE_REQUEST_OPENED_EVENT, GitLabTestCase
from sentry.integrations.gitlab.webhooks import MergeEventWebhook
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.code_review.webhooks.merge_request import handle_merge_request_event
from sentry.seer.code_review.webhooks.seat_tracking import (
    SEAT_SEEN_KEY_PREFIX,
    track_gitlab_contributor_seat_processor,
)
from sentry.utils.redis import redis_clusters


def test_processor_runs_before_code_review_handler() -> None:
    # Order matters: the seat processor must run before
    # handle_merge_request_event, otherwise preflight billing finds no
    # contributor row and denies the first MR open from a new author.
    processors = MergeEventWebhook.WEBHOOK_EVENT_PROCESSORS
    assert track_gitlab_contributor_seat_processor in processors
    assert handle_merge_request_event in processors
    assert processors.index(track_gitlab_contributor_seat_processor) < processors.index(
        handle_merge_request_event
    )


def _make_event(action: str = "open", **overrides: object) -> dict[str, Any]:
    event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
    event["object_attributes"]["action"] = action
    for key, value in overrides.items():
        event["object_attributes"][key] = value
    return event


def _rpc_org(org: Organization) -> RpcOrganization:
    return RpcOrganization(id=org.id, slug=org.slug, name=org.name)


class TrackGitlabContributorSeatProcessorTest(GitLabTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_gitlab_repo("getsentry/sentry")
        self.rpc_organization = _rpc_org(self.organization)

    def _call(self, event: dict[str, Any] | None = None) -> None:
        track_gitlab_contributor_seat_processor(
            event=event if event is not None else _make_event(),
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_calls_track_contributor_seat_on_open(self, mock_track: Any) -> None:
        self._call()

        mock_track.assert_called_once()
        kwargs = mock_track.call_args.kwargs
        assert kwargs["organization"].id == self.organization.id
        assert kwargs["repo"].id == self.repo.id
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["user_id"] == 51
        assert kwargs["user_username"] == "root"
        assert kwargs["provider"] == "gitlab"

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_on_update_action(self, mock_track: Any) -> None:
        self._call(event=_make_event(action="update"))
        mock_track.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_on_close_action(self, mock_track: Any) -> None:
        self._call(event=_make_event(action="close"))
        mock_track.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_without_integration(self, mock_track: Any) -> None:
        track_gitlab_contributor_seat_processor(
            event=_make_event(),
            organization=self.rpc_organization,
            repo=self.repo,
            integration=None,
        )
        mock_track.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_when_author_id_missing(self, mock_track: Any) -> None:
        event = _make_event()
        del event["object_attributes"]["author_id"]
        self._call(event=event)
        mock_track.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_when_username_missing(self, mock_track: Any) -> None:
        event = _make_event()
        del event["user"]["username"]
        self._call(event=event)
        mock_track.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_duplicate_delivery_within_window_skipped(self, mock_track: Any) -> None:
        # GitLab redelivers webhooks on response timeout, and the endpoint
        # dispatches each payload once per installed organization. Both can
        # otherwise cause num_actions to be incremented multiple times for a
        # single MR-open. The Redis TTL key per (org, repo, MR iid) deduplicates.
        event = _make_event()
        self._call(event=event)
        self._call(event=event)

        mock_track.assert_called_once()

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_duplicate_delivery_after_ttl_processes_again(self, mock_track: Any) -> None:
        event = _make_event()
        self._call(event=event)
        assert mock_track.call_count == 1

        # Simulate TTL expiry so the same delivery can be processed again.
        iid = event["object_attributes"]["iid"]
        seen_key = f"{SEAT_SEEN_KEY_PREFIX}{self.organization.id}:{self.repo.id}:{iid}"
        redis_clusters.get("default").delete(seen_key)

        self._call(event=event)
        assert mock_track.call_count == 2

    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_missing_organization_does_not_poison_dedup(self, mock_track: Any) -> None:
        # If the Organization can't be resolved, no Redis key is set, so a
        # subsequent delivery for a valid org with the same key shape still
        # has a chance to seed the contributor.
        event = _make_event()
        iid = event["object_attributes"]["iid"]
        seen_key = f"{SEAT_SEEN_KEY_PREFIX}{self.organization.id}:{self.repo.id}:{iid}"

        with patch(
            "sentry.seer.code_review.webhooks.seat_tracking.Organization.objects.get_from_cache",
            side_effect=Organization.DoesNotExist,
        ):
            self._call(event=event)

        mock_track.assert_not_called()
        assert redis_clusters.get("default").get(seen_key) is None

        # Now the lookup succeeds — the same delivery should proceed.
        self._call(event=event)
        mock_track.assert_called_once()
