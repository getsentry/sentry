import logging
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
    track_gitlab_contributor_action_processor,
    track_gitlab_contributor_seat_processor,
)
from sentry.testutils.helpers.features import with_feature
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

    @with_feature("organizations:seer-gitlab-support")
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
    def test_no_call_without_cohort_flag(self, mock_track: Any) -> None:
        self._call()
        mock_track.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_on_update_action(self, mock_track: Any) -> None:
        self._call(event=_make_event(action="update"))
        mock_track.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_on_close_action(self, mock_track: Any) -> None:
        self._call(event=_make_event(action="close"))
        mock_track.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_without_integration(self, mock_track: Any) -> None:
        track_gitlab_contributor_seat_processor(
            event=_make_event(),
            organization=self.rpc_organization,
            repo=self.repo,
            integration=None,
        )
        mock_track.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_when_author_id_missing(self, mock_track: Any) -> None:
        event = _make_event()
        del event["object_attributes"]["author_id"]
        self._call(event=event)
        mock_track.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_when_username_missing(self, mock_track: Any) -> None:
        event = _make_event()
        del event["user"]["username"]
        self._call(event=event)
        mock_track.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.logger")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_when_actor_is_not_author(self, mock_track: Any, mock_logger: Any) -> None:
        # The MR author (object_attributes.author_id) and the webhook actor
        # (event.user) diverge — e.g. an MR opened via the API on behalf of
        # another author. Seeding would store the actor's username as the alias
        # for the author's external_identifier, so we skip instead.
        event = _make_event()
        event["user"]["id"] = event["object_attributes"]["author_id"] + 1
        self._call(event=event)
        mock_track.assert_not_called()
        mock_logger.log.assert_any_call(
            logging.WARNING,
            "actor_author_mismatch",
            extra={
                "seer.webhooks.organization_id": self.organization.id,
                "seer.webhooks.provider_name": "gitlab",
                "seer.webhooks.repository_id": self.repo.id,
                "seer.webhooks.integration_id": self.integration.id,
                "seer.webhooks.merge_request_iid": event["object_attributes"]["iid"],
                "seer.webhooks.merge_request_action": event["object_attributes"]["action"],
                "seer.webhooks.author_id": event["object_attributes"]["author_id"],
                "seer.webhooks.actor_id": event["user"]["id"],
                "seer.webhooks.contributor_tracking_stage": "seat",
            },
            exc_info=False,
        )

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_no_call_when_actor_id_missing(self, mock_track: Any) -> None:
        event = _make_event()
        del event["user"]["id"]
        self._call(event=event)
        mock_track.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.track_contributor_seat")
    def test_actor_mismatch_does_not_poison_dedup(self, mock_track: Any) -> None:
        # A skipped mismatch delivery must not consume the dedup window: a later
        # delivery for the same MR whose actor IS the author still seeds.
        mismatch = _make_event()
        mismatch["user"]["id"] = mismatch["object_attributes"]["author_id"] + 1
        self._call(event=mismatch)
        mock_track.assert_not_called()

        self._call(event=_make_event())
        mock_track.assert_called_once()

    @with_feature("organizations:seer-gitlab-support")
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

    @with_feature("organizations:seer-gitlab-support")
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

    @with_feature("organizations:seer-gitlab-support")
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


class TrackGitlabContributorActionProcessorTest(GitLabTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_gitlab_repo("getsentry/sentry")
        self.rpc_organization = _rpc_org(self.organization)

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_success(self, mock_record: Any) -> None:
        track_gitlab_contributor_action_processor(
            event=_make_event(),
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )

        mock_record.assert_called_once()
        kwargs = mock_record.call_args.kwargs
        assert kwargs["organization"].id == self.organization.id
        assert kwargs["repo"].id == self.repo.id
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["user_id"] == 51
        assert kwargs["user_username"] == "root"
        assert kwargs["provider"] == "gitlab"
        assert kwargs["pr_number"] == 1
        assert kwargs["is_opened"] is True
        assert kwargs["tags"] == {"is_private": True}

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_is_opened_false_for_non_open_action(self, mock_record: Any) -> None:
        track_gitlab_contributor_action_processor(
            event=_make_event(action="update"),
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )
        assert mock_record.call_args.kwargs["is_opened"] is False

    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_no_feature_flag(self, mock_record: Any) -> None:
        track_gitlab_contributor_action_processor(
            event=_make_event(),
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )
        mock_record.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_no_integration(self, mock_record: Any) -> None:
        track_gitlab_contributor_action_processor(
            event=_make_event(),
            organization=self.rpc_organization,
            repo=self.repo,
            integration=None,
        )
        mock_record.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_missing_author_id(self, mock_record: Any) -> None:
        event = _make_event()
        del event["object_attributes"]["author_id"]
        track_gitlab_contributor_action_processor(
            event=event,
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )
        mock_record.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_missing_iid(self, mock_record: Any) -> None:
        event = _make_event()
        del event["object_attributes"]["iid"]
        track_gitlab_contributor_action_processor(
            event=event,
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )
        mock_record.assert_not_called()

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.logger")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_no_call_when_actor_is_not_author(self, mock_record: Any, mock_logger: Any) -> None:
        # The row is keyed by the author id but seeded with the actor's username
        # as the alias, so skip seeding when the actor is not the author.
        event = _make_event()
        event["user"]["id"] = event["object_attributes"]["author_id"] + 1
        track_gitlab_contributor_action_processor(
            event=event,
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )
        mock_record.assert_not_called()
        mock_logger.log.assert_any_call(
            logging.WARNING,
            "actor_author_mismatch",
            extra={
                "seer.webhooks.organization_id": self.organization.id,
                "seer.webhooks.provider_name": "gitlab",
                "seer.webhooks.repository_id": self.repo.id,
                "seer.webhooks.integration_id": self.integration.id,
                "seer.webhooks.merge_request_iid": event["object_attributes"]["iid"],
                "seer.webhooks.merge_request_action": event["object_attributes"]["action"],
                "seer.webhooks.author_id": event["object_attributes"]["author_id"],
                "seer.webhooks.actor_id": event["user"]["id"],
                "seer.webhooks.contributor_tracking_stage": "action",
            },
            exc_info=False,
        )

    @with_feature("organizations:seer-gitlab-support")
    @patch("sentry.seer.code_review.webhooks.seat_tracking.record_contributor_action")
    def test_missing_actor_id(self, mock_record: Any) -> None:
        event = _make_event()
        del event["user"]["id"]
        track_gitlab_contributor_action_processor(
            event=event,
            organization=self.rpc_organization,
            repo=self.repo,
            integration=self.integration,
        )
        mock_record.assert_not_called()
