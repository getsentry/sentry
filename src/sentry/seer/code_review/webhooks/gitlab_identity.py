"""
Resolve the GitLab integration's own actor identity so webhook handlers can skip
merge requests the integration authored itself.

Without this, an MR opened by the integration's own GitLab account (the OAuth
token-owner Sentry acts as) would seed/increment an ``OrganizationContributors``
row for seat billing and trigger a Seer review of our own MR. The alias-based
``OrganizationContributors.is_bot`` heuristic does not catch this on GitLab,
which has no ``[bot]`` username convention.

We resolve "our" GitLab user id via ``get_authenticated_actor`` — the same source
``merge_request.py`` already trusts as our identity for reaction de-duplication —
and cache it in Redis per ``(organization, integration)`` so it costs at most one
GitLab API call per TTL window. Every failure path fails **open** (returns
``None`` / ``False`` so the caller processes the event normally): mistakenly
processing one self-authored MR is recoverable, silently dropping a real
contributor is not.
"""

from __future__ import annotations

import logging

from scm import actions as scm_actions
from scm.types import GetAuthenticatedActorProtocol

from sentry.models.repository import Repository
from sentry.scm import factory as scm_factory
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

# Cache the integration's own GitLab user id so we don't call GET /user on every
# webhook delivery. Keyed per (org, integration) since a token rotation could
# change the acting user; the TTL bounds how long a stale id can survive.
ACTOR_CACHE_KEY_PREFIX = "webhook:gitlab:actor:"
ACTOR_CACHE_TTL_SECONDS = 3600


def get_integration_actor_id(organization_id: int, repo: Repository) -> str | None:
    """
    Return the GitLab user id the integration authenticates as, or None.

    The result is cached in Redis for ``ACTOR_CACHE_TTL_SECONDS``. Returns None on
    any cache/API/provider error so callers fail open and process the event.
    """
    if repo.integration_id is None:
        return None

    cache_key = f"{ACTOR_CACHE_KEY_PREFIX}{organization_id}:{repo.integration_id}"

    try:
        cluster = redis_clusters.get("default")
        cached = cluster.get(cache_key)
    except Exception:
        logger.warning("gitlab.webhook.actor.cache_read_failed")
        cluster = None
        cached = None

    if cached is not None:
        return cached

    try:
        scm = scm_factory.new(organization_id, repo.id, "code-review-webhook")
        if not isinstance(scm, GetAuthenticatedActorProtocol):
            logger.warning("gitlab.webhook.actor.unsupported_provider")
            return None
        actor_id = str(scm_actions.get_authenticated_actor(scm)["data"]["id"])
    except Exception:
        logger.warning("gitlab.webhook.actor.fetch_failed", exc_info=True)
        return None

    if cluster is not None:
        try:
            cluster.set(cache_key, actor_id, ex=ACTOR_CACHE_TTL_SECONDS)
        except Exception:
            logger.warning("gitlab.webhook.actor.cache_write_failed")

    return actor_id


def is_self_authored_mr(*, organization_id: int, repo: Repository, author_id: object) -> bool:
    """
    True when ``author_id`` is the integration's own GitLab user.

    Fails open (returns False) when the author is unknown or the integration's
    actor id can't be resolved, so a resolution failure never drops a real MR.
    """
    if not author_id:
        return False
    actor_id = get_integration_actor_id(organization_id, repo)
    if actor_id is None:
        return False
    return str(author_id) == actor_id
