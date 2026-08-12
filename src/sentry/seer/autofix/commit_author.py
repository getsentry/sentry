from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import FeedbackSourceBase
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrCommentUser,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.utils import get_github_username_for_user
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

GITHUB_NOREPLY_DOMAIN = "users.noreply.github.com"


class SeerCommitAuthor(TypedDict):
    """Git commit author sent to Seer; wire-compatible with ``scm.types.CommitAuthorParam``."""

    name: str
    email: str


def _record_outcome(outcome: str) -> None:
    metrics.incr("autofix.commit_author.resolved", tags={"outcome": outcome})


def _build_author(
    *, login: str, external_id: str | int | None, name: str | None
) -> SeerCommitAuthor:
    login = login.lstrip("@")
    external_id = str(external_id) if external_id is not None else ""
    # Both noreply forms attribute the commit to the GitHub account. The id-prefixed
    # one is canonical and survives a username change; the login-only form is what
    # GitHub itself issues to pre-2017 accounts, so it stays a usable fallback rather
    # than a failure. See https://docs.github.com/en/account-and-profile/reference/email-addresses-reference
    email = (
        f"{external_id}+{login}@{GITHUB_NOREPLY_DOMAIN}"
        if external_id.isdigit()
        else f"{login}@{GITHUB_NOREPLY_DOMAIN}"
    )
    return SeerCommitAuthor(name=name or login, email=email)


def commit_author_for_github_actor(
    *,
    login: str,
    external_id: str | int | None = None,
    name: str | None = None,
) -> SeerCommitAuthor:
    """For a raw GitHub actor, i.e. the webhook paths."""
    author = _build_author(login=login, external_id=external_id, name=name)
    _record_outcome("github_actor")
    return author


def _github_com_external_actor(
    user_id: int, organization_id: int, login: str
) -> ExternalActor | None:
    return (
        ExternalActor.objects.filter(
            Q(external_name__iexact=login) | Q(external_name__iexact=f"@{login}"),
            user_id=user_id,
            organization_id=organization_id,
            provider=ExternalProviders.GITHUB.value,
        )
        .order_by("-date_added")
        .first()
    )


def _is_github_enterprise_only(user_id: int, organization_id: int) -> bool:
    """True when the user's only GitHub link is Enterprise, which has no github.com identity."""
    providers = set(
        ExternalActor.objects.filter(
            user_id=user_id,
            organization_id=organization_id,
            provider__in=[
                ExternalProviders.GITHUB.value,
                ExternalProviders.GITHUB_ENTERPRISE.value,
            ],
        ).values_list("provider", flat=True)
    )
    return bool(providers) and ExternalProviders.GITHUB.value not in providers


def commit_author_for_user(
    user: User | RpcUser | AnonymousUser | None,
    organization_id: int,
    *,
    referrer: str,
) -> SeerCommitAuthor | None:
    """The acting user's GitHub identity, or ``None`` to let Seer author the commit."""
    if user is None or isinstance(user, AnonymousUser) or user.id is None:
        _record_outcome("no_acting_user")
        return None

    try:
        login = get_github_username_for_user(user, organization_id, referrer=referrer)
        if not login:
            _record_outcome("no_github_identity")
            return None

        # A GitHub Enterprise login has no github.com account behind it, so the
        # noreply address would point at a stranger or nobody.
        if _is_github_enterprise_only(user.id, organization_id):
            _record_outcome("github_enterprise_only")
            return None

        external_actor = _github_com_external_actor(user.id, organization_id, login)
        author = _build_author(
            login=login,
            external_id=external_actor.external_id if external_actor else None,
            name=user.get_display_name(),
        )
    except Exception:
        logger.exception(
            "autofix.commit_author.resolve_failed",
            extra={"organization_id": organization_id, "referrer": referrer},
        )
        _record_outcome("resolve_error")
        return None

    _record_outcome("sentry_user")
    return author


def _github_user(source: FeedbackSourceBase) -> GithubPrCommentUser | None:
    if isinstance(source, (GithubPrCommentFeedbackSource, GithubPrReviewCommentFeedbackSource)):
        return source.comment.user
    if isinstance(source, GithubPrReviewBodyFeedbackSource):
        return source.user
    return None


def _github_external_id_from_items(items: Sequence[Feedback]) -> str | None:
    """The first GitHub numeric id among the items, if any carries one."""
    for item in items:
        user = _github_user(item.source)
        if user is not None and user.id is not None:
            return str(user.id)
    return None


def _feedback_actor(source: FeedbackSourceBase) -> tuple[str, str] | None:
    """``(kind, identifier)`` for the human behind one feedback item."""
    if isinstance(source, UserUIFeedbackSource):
        return ("user", str(source.user_id))

    user = _github_user(source)
    if user is None or not user.login:
        return None
    # Keyed on login alone; the numeric id is resolved separately so items that
    # carry it and items that don't still count as the same person.
    return ("github", user.login.lstrip("@").lower())


def commit_author_for_feedback(
    items: Sequence[Feedback], organization_id: int
) -> SeerCommitAuthor | None:
    """The author for an iteration, set only when one human drove all of its feedback."""
    try:
        if not items:
            _record_outcome("no_feedback")
            return None

        if any(item.source.is_automated for item in items):
            _record_outcome("automated_feedback")
            return None

        actors = {_feedback_actor(item.source) for item in items}
        if len(actors) != 1:
            _record_outcome("multiple_feedback_actors")
            return None

        actor = actors.pop()
        if actor is None:
            _record_outcome("unidentified_feedback_actor")
            return None

        kind, identifier = actor
        if kind == "github":
            return commit_author_for_github_actor(
                login=identifier, external_id=_github_external_id_from_items(items)
            )

        user = user_service.get_user(user_id=int(identifier))
    except Exception:
        logger.exception(
            "autofix.commit_author.feedback_failed",
            extra={"organization_id": organization_id},
        )
        _record_outcome("feedback_error")
        return None
    return commit_author_for_user(user, organization_id, referrer="autofix_pr_iteration")


def parse_commit_author(raw: str | None) -> SeerCommitAuthor | None:
    """Read an author back off block metadata; anything unexpected means no author."""
    if not isinstance(raw, str) or not raw:
        return None
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    name, email = data.get("name"), data.get("email")
    if not isinstance(name, str) or not isinstance(email, str):
        return None
    return SeerCommitAuthor(name=name, email=email)
