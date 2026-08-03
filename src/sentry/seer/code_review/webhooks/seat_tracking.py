"""
GitLab merge_request webhook processor that seeds OrganizationContributors so
seat-based Seer billing works once an org is moved onto
``organizations:seat-based-seer-enabled``. Same goal as GitHub's
``_track_contributor_action_processor`` call in ``PullRequestEventWebhook`` (see
``sentry/integrations/github/webhook.py``).

``track_gitlab_contributor_action_processor`` calls ``record_contributor_action``,
which seeds the contributor on every delivery and, for an eligible MR *open*,
creates an ``OrganizationContributorAction`` row keyed by
``(repository_id, pr_number)`` and increments ``num_actions``. The unique
constraint absorbs GitLab's redeliveries without double-counting.

``track_gitlab_contributor_seat_processor`` is the legacy seat-charging path,
now informational logging only. GitLab's ``MergeEventWebhook.__call__`` discards the
``created`` return and calls ``_handle`` for every action, so the processor cannot
rely on DB state. Instead we (a) filter on ``object_attributes.action == "open"``
(the GitLab analog of GitHub's "opened") and (b) record a short-lived Redis key per
``(org, repo, MR iid)`` to drop re-deliveries within the TTL window. GitLab
redelivers merge_request hooks on response timeout and the endpoint also
dispatches each payload once per installed organization; both can otherwise
cause actions to be logged multiple times for a single MR-open.

Both processors are gated by ``organizations:seer-gitlab-support`` — the same
cohort flag ``handle_merge_request_event`` uses — so seeding only happens for orgs
that are already opted in to GitLab code review. The downstream
``should_increment_contributor_seat`` check additionally requires
``organizations:seat-based-seer-enabled``.

Both processors skip seeding when the webhook actor (``event.user``) is not the
MR author (``object_attributes.author_id``): the row is keyed by the author but
its ``alias`` defaults to the actor's username, so on a mismatch (e.g. a
reviewer approving or a maintainer merging someone else's MR) we'd store the
wrong alias. This is expected, high-volume traffic, so we skip silently.

``MergeEventWebhook.WEBHOOK_EVENT_PROCESSORS`` registers these
**before** ``handle_merge_request_event`` so the contributor row exists when
the code-review handler's preflight billing check runs. Without that
ordering, the first MR open from a new contributor would be denied with
``ORG_CONTRIBUTOR_NOT_FOUND`` even though the same delivery seeds the row
seconds later.

Known gap: ``MergeEventWebhook.__call__`` short-circuits before ``_handle``
when the payload is missing ``last_commit`` or the author's email
(``test_merge_event_no_last_commit``). In that case these processors never
run, so the MR author is not seeded on that delivery, though a later
non-short-circuited event for the same MR will. Tracked on SCM-99 as a
follow-up.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry import features
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.code_review.contributor_seats import (
    record_contributor_action,
    track_contributor_seat,
)
from sentry.seer.code_review.webhooks.logging import debug_log
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

# Mirrors the dedup pattern in ``merge_request.py``. Distinct prefix so seat
# tracking and code-review dispatch don't share a namespace.
SEAT_SEEN_KEY_PREFIX = "webhook:gitlab:seat_tracking:"
SEAT_SEEN_TTL_SECONDS = 20


def _is_duplicate_delivery(seen_key: str) -> bool:
    """
    True if a delivery with this key was already processed within the TTL window.

    On Redis errors we return False (process anyway) — double-counting the
    informational log once is preferable to losing it entirely.
    """
    try:
        cluster = redis_clusters.get("default")
        is_first_time_seen = cluster.set(seen_key, "1", ex=SEAT_SEEN_TTL_SECONDS, nx=True)
    except Exception:
        logger.warning("gitlab.webhook.seat_tracking.mark_seen_failed")
        return False
    return not is_first_time_seen


def track_gitlab_contributor_seat_processor(
    *,
    event: Mapping[str, Any],
    organization: RpcOrganization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    object_attributes = event.get("object_attributes") or {}
    base_extra = {
        "organization_id": organization.id,
        "repo_id": repo.id,
        "mr_iid": object_attributes.get("iid"),
        "action": object_attributes.get("action"),
    }

    if integration is None:
        debug_log(logger, organization, "missing_integration", base_extra)
        return

    base_extra["integration_id"] = integration.id

    if not features.has("organizations:seer-gitlab-support", organization):
        return

    if object_attributes.get("action") != "open":
        return

    try:
        user_id = object_attributes["author_id"]
        event_user = event["user"]
        event_actor_id = event_user["id"]
        user_username = event_user["username"]
        iid = object_attributes["iid"]
    except KeyError as e:
        debug_log(
            logger,
            organization,
            "missing_author_data",
            {**base_extra, "error": str(e)},
            level=logging.WARNING,
        )
        return

    base_extra["author_id"] = user_id

    # Skip when the webhook actor isn't the MR author: alias comes from the actor
    # but the row is keyed by the author, so seeding would store the wrong alias.
    # Runs before the dedup mark so a skipped mismatch doesn't block a later,
    # matching delivery from seeding the author. This is expected traffic (a
    # reviewer/maintainer/bot acting on someone else's MR), so we skip silently.
    if user_id != event_actor_id:
        return

    # Resolve the Organization before marking the delivery as seen so a missing
    # org does not poison the dedup window and block GitLab redeliveries from
    # logging the contributor later.
    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        debug_log(logger, organization, "organization_not_found", base_extra)
        return

    seen_key = f"{SEAT_SEEN_KEY_PREFIX}{organization.id}:{repo.id}:{iid}"
    if _is_duplicate_delivery(seen_key):
        debug_log(logger, organization, "duplicate_delivery_skipped", base_extra)
        return

    track_contributor_seat(
        organization=org,
        repo=repo,
        integration=integration,
        user_id=user_id,
        user_username=user_username,
        logs_extra={
            "pr_number": str(iid),
            "github_event_action": object_attributes.get("action"),
        },
    )


def track_gitlab_contributor_action_processor(
    *,
    event: Mapping[str, Any],
    organization: RpcOrganization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    if integration is None:
        return

    if not features.has("organizations:seer-gitlab-support", organization):
        return

    object_attributes = event.get("object_attributes") or {}
    try:
        user_id = object_attributes["author_id"]
        event_user = event["user"]
        event_actor_id = event_user["id"]
        user_username = event_user["username"]
        iid = object_attributes["iid"]
    except KeyError:
        return

    # Skip when the webhook actor isn't the MR author, to avoid seeding the wrong
    # alias against the author's row (see track_gitlab_contributor_seat_processor).
    # Expected traffic (reviewer/maintainer/bot acting on someone else's MR), so
    # we skip silently.
    if user_id != event_actor_id:
        return

    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        return

    # GitLab visibility_level: 0 = private, 10 = internal, 20 = public.
    visibility_level = (event.get("project") or {}).get("visibility_level")

    record_contributor_action(
        organization=org,
        repo=repo,
        integration=integration,
        user_id=user_id,
        user_username=user_username,
        pr_number=iid,
        is_opened=object_attributes.get("action") == "open",
        tags={"is_private": visibility_level == 0},
    )
