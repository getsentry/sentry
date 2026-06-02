"""
GitLab merge_request webhook processor that seeds OrganizationContributors so
seat-based Seer billing works once an org is moved onto
``organizations:seat-based-seer-enabled``. Same goal as GitHub's
``track_contributor_seat`` call in ``PullRequestEventWebhook._handle`` (see
``sentry/integrations/github/webhook.py``), but uses different idempotency
mechanics:

- GitHub guards the call with ``if created:`` from
  ``PullRequest.objects.update_or_create``, so re-delivery of the same
  ``pull_request opened`` event is a no-op once the PR row exists.
- GitLab's ``MergeEventWebhook.__call__`` discards the ``created`` return and
  calls ``_handle`` for every action, so the processor cannot rely on DB state.
  Instead we (a) filter on ``object_attributes.action == "open"`` (the GitLab
  analog of GitHub's "opened") and (b) record a short-lived Redis key per
  ``(org, repo, MR iid)`` to drop re-deliveries within the TTL window. GitLab
  redelivers merge_request hooks on response timeout and the endpoint also
  dispatches each payload once per installed organization; both can otherwise
  cause ``num_actions`` to be incremented multiple times for a single MR-open.

Gated by ``organizations:seer-code-review-gitlab`` — the same cohort flag
``handle_merge_request_event`` uses — so seeding only happens for orgs that
are already opted in to GitLab code review. The downstream call to
``should_increment_contributor_seat`` additionally requires
``organizations:seat-based-seer-enabled`` before any row is actually written
or a seat is assigned.

``MergeEventWebhook.WEBHOOK_EVENT_PROCESSORS`` registers this processor
**before** ``handle_merge_request_event`` so the contributor row exists when
the code-review handler's preflight billing check runs. Without that
ordering, the first MR open from a new contributor would be denied with
``ORG_CONTRIBUTOR_NOT_FOUND`` even though the same delivery seeds the row
seconds later.

Known gap: ``MergeEventWebhook.__call__`` short-circuits before ``_handle``
when the payload is missing ``last_commit`` or the author's email
(``test_merge_event_no_last_commit``). In that case this processor never
runs, so the MR author is not seeded. Subsequent ``update`` events for the
same MR do not fire the processor either (the action filter is ``"open"``).
Tracked on SCM-99 as a follow-up.
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
from sentry.seer.code_review.contributor_seats import track_contributor_seat
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

# Mirrors the dedup pattern in ``merge_request.py``. Distinct prefix so seat
# tracking and code-review dispatch don't share a namespace.
SEAT_SEEN_KEY_PREFIX = "webhook:gitlab:seat_tracking:"
SEAT_SEEN_TTL_SECONDS = 20


def _is_duplicate_delivery(seen_key: str) -> bool:
    """
    True if a delivery with this key was already processed within the TTL window.

    On Redis errors we return False (process anyway) — double-counting once is
    preferable to losing seat tracking entirely.
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
    if integration is None:
        return
    if not features.has("organizations:seer-code-review-gitlab", organization):
        return

    object_attributes = event.get("object_attributes") or {}
    if object_attributes.get("action") != "open":
        return

    try:
        user_id = object_attributes["author_id"]
        user_username = event["user"]["username"]
        iid = object_attributes["iid"]
    except KeyError as e:
        logger.warning(
            "gitlab.webhook.seat_tracking.missing-author-data",
            extra={"integration_id": integration.id, "error": str(e)},
        )
        return

    # Resolve the Organization before marking the delivery as seen so a missing
    # org does not poison the dedup window and block GitLab redeliveries from
    # seeding the contributor later.
    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        return

    seen_key = f"{SEAT_SEEN_KEY_PREFIX}{organization.id}:{repo.id}:{iid}"
    if _is_duplicate_delivery(seen_key):
        logger.info("gitlab.webhook.seat_tracking.duplicate_delivery_skipped")
        return

    track_contributor_seat(
        organization=org,
        repo=repo,
        integration_id=integration.id,
        user_id=user_id,
        user_username=user_username,
        provider="gitlab",
    )
