"""
Tracks whether the caller acts on the related issues GroupRelatedEndpoint showed them, broken down
by the relation types that matched each issue.

When the endpoint returns, each issue it lists is remembered for an hour under the caller's user or
service account, with its relation types, its rank and the issue it was related to. When the same
caller later views, updates or comments on one of those issues, the request records a follow-up:
the issues.related.follow_up metric, tagged with the issue's relation types and the action, and
span attributes with the details. This works for any client of the endpoint, including the Sentry
MCP server's find_related_issues and get_issue_details tools.

Relation types are reported as their sorted combination joined by "+", such as
"same_trace+similar_stacktrace", so an issue matched by several types is counted once.
"""

from __future__ import annotations

import functools
import logging
import time
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from typing import TYPE_CHECKING, Any, TypedDict

import orjson
import sentry_sdk
from rest_framework.request import Request

from sentry import options
from sentry.auth.principal import acting_user_id
from sentry.models.group import Group
from sentry.service_accounts.auth import is_service_account_auth
from sentry.utils import metrics, redis

if TYPE_CHECKING:
    # The group serializer that types.py imports imports sentry.api.helpers.group_index, which
    # imports this module.
    from sentry.issues.related.types import RelatedIssue, RelatedIssuesResponse

logger = logging.getLogger(__name__)

# How long a shown issue counts for follow-ups
SHOWN_TTL_SECONDS = 60 * 60
OPTION = "issues.related.track-follow-ups"

VIEW = "view"
COMMENT = "comment"


class ShownIssue(TypedDict):
    relationTypes: str
    rank: int
    sourceGroupId: int
    shownAt: float
    score: float | None


def _never_raise[**P](fn: Callable[P, None]) -> Callable[P, None]:
    """Telemetry only: a Redis failure must not fail the request it's recorded on."""

    @functools.wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> None:
        try:
            fn(*args, **kwargs)
        except Exception:
            logger.exception("issues.related.follow_ups.failed")

    return wrapper


def _client() -> Any:
    return redis.redis_clusters.get("default")


def _actor_key(request: Request) -> str | None:
    """Who the caller is, or None when there's no user or service account to tie actions to."""
    user_id = acting_user_id(request.user)
    if user_id is not None:
        return f"u{user_id}"
    if is_service_account_auth(request.auth):
        return f"sa{request.auth.entity_id}"
    return None


def _key(actor: str, group_id: int) -> str:
    # The hash tag keeps one caller's keys in one cluster slot, so MGET works.
    return f"related-issues:shown:{{{actor}}}:{group_id}"


def _client_tag(request: Request) -> str:
    """How the caller authenticated: a token (API, MCP, agents) or a session (the Sentry UI)."""
    return "token" if request.auth is not None else "session"


def _relation_types(item: RelatedIssue) -> str:
    return "+".join(sorted(relation["type"] for relation in item["relations"]))


@_never_raise
def record_shown(request: Request, source_group: Group, response: RelatedIssuesResponse) -> None:
    """Remember the issues the endpoint returned, so later actions on them can be attributed."""
    if not response["data"] or not options.get(OPTION):
        return
    actor = _actor_key(request)
    if actor is None:
        return

    now = time.time()
    relation_types = [_relation_types(item) for item in response["data"]]
    pipe = _client().pipeline(transaction=False)
    for rank, (item, types) in enumerate(zip(response["data"], relation_types), start=1):
        shown: ShownIssue = {
            "relationTypes": types,
            "rank": rank,
            "sourceGroupId": source_group.id,
            "shownAt": now,
            "score": next((r["score"] for r in item["relations"] if "score" in r), None),
        }
        pipe.set(_key(actor, int(item["issue"]["id"])), orjson.dumps(shown), ex=SHOWN_TTL_SECONDS)
    pipe.execute()

    for types, count in Counter(relation_types).items():
        metrics.incr(
            "issues.related.shown",
            amount=count,
            tags={"relation_types": types},
            sample_rate=1.0,
        )
    sentry_sdk.set_attribute(
        "related_issues.shown.issue_ids", ",".join(item["issue"]["id"] for item in response["data"])
    )
    sentry_sdk.set_attribute("related_issues.shown.relation_types", ",".join(relation_types))


@_never_raise
def record_follow_up(request: Request, groups: Sequence[Group], action: str) -> None:
    """
    Record an action on issues GroupRelatedEndpoint showed this caller in the last hour. Each
    issue and action is counted once per showing.
    """
    if not groups or not options.get(OPTION):
        return
    actor = _actor_key(request)
    if actor is None:
        return

    client = _client()
    keys = [_key(actor, group.id) for group in groups]
    values = client.mget(keys)
    hits: list[tuple[Group, ShownIssue]] = [
        (group, orjson.loads(value)) for group, value in zip(groups, values) if value is not None
    ]
    if not hits:
        return

    for group, shown in hits:
        # SET NX: only the first action of each kind on each showing counts.
        dedupe_key = f"{_key(actor, group.id)}:{action}:{shown['shownAt']}"
        if client.set(dedupe_key, 1, ex=SHOWN_TTL_SECONDS, nx=True):
            metrics.incr(
                "issues.related.follow_up",
                tags={
                    "relation_types": shown["relationTypes"],
                    "action": action,
                    "client": _client_tag(request),
                },
                sample_rate=1.0,
            )

    sentry_sdk.set_attribute("related_issues.follow_up.action", action)
    sentry_sdk.set_attribute(
        "related_issues.follow_up.issue_ids", ",".join(str(group.id) for group, _ in hits)
    )
    sentry_sdk.set_attribute(
        "related_issues.follow_up.relation_types",
        ",".join(shown["relationTypes"] for _, shown in hits),
    )
    sentry_sdk.set_attribute(
        "related_issues.follow_up.source_issue_ids",
        ",".join(str(shown["sourceGroupId"]) for _, shown in hits),
    )
    sentry_sdk.set_attribute(
        "related_issues.follow_up.ranks", ",".join(str(shown["rank"]) for _, shown in hits)
    )
    sentry_sdk.set_attribute(
        "related_issues.follow_up.scores",
        ",".join("" if shown["score"] is None else str(shown["score"]) for _, shown in hits),
    )
    sentry_sdk.set_attribute(
        "related_issues.follow_up.seconds_since_shown",
        int(time.time() - max(shown["shownAt"] for _, shown in hits)),
    )


def update_action(data: Mapping[str, Any]) -> str:
    """A bounded name for what an issue update did, for the follow-up metric's action tag."""
    if data.get("discard"):
        return "discard"
    if data.get("merge"):
        return "merge"
    status = data.get("status")
    if isinstance(status, str):
        if status.startswith("resolved"):
            return "resolve"
        if status == "ignored":
            return "ignore"
        if status == "unresolved":
            return "unresolve"
    if "assignedTo" in data:
        return "assign"
    return "update"
