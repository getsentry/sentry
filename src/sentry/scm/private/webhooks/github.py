import logging
import typing
from typing import Optional

import msgspec
from scm.types import (
    CheckRunAction,
    CommentAction,
    EventTypeHint,
    PullRequestAction,
)

from sentry.scm.types import (
    CheckRunEvent,
    CommentEvent,
    EventType,
    PullRequestEvent,
    SubscriptionEvent,
)

logger = logging.getLogger(__name__)

# Valid pull request action strings, derived from the PullRequestAction type alias.
# Used to gracefully skip events with action values not yet in our type definition
# (e.g. new GitHub features like "stacked") instead of crashing on decode.
_KNOWN_PR_ACTIONS: frozenset[str] = frozenset(
    typing.get_args(getattr(PullRequestAction, "__value__", PullRequestAction))
)

# Remaining types in use:
#   * "installation"
#   * "installation_repositories"
#   * "issues"
#   * "pull_request_review"
#   * "pull_request_review_comment"
#   * "push"


class GitHubUser(msgspec.Struct):
    id: int
    login: str  # Username
    type: str | None = None


class GitHubCheckRunEvent(msgspec.Struct, gc=False):
    action: CheckRunAction
    check_run: "GitHubCheckRun"


class GitHubCheckRun(msgspec.Struct, gc=False):
    external_id: str
    html_url: str


class GitHubIssueCommentEvent(msgspec.Struct, gc=False):
    action: CommentAction
    comment: "GitHubIssueComment"
    issue: "GitHubIssue"


class GitHubIssueComment(msgspec.Struct, gc=False):
    id: int
    user: GitHubUser | None
    body: str | None = None


class GitHubIssueCommentPullRequest(msgspec.Struct, gc=False):
    pass


class GitHubIssue(msgspec.Struct, gc=False):
    number: int
    pull_request: GitHubIssueCommentPullRequest | None = None


class GitHubPullRequestEvent(msgspec.Struct, gc=False):
    action: str  # str so unknown future GitHub action types don't fail validation
    number: int
    pull_request: "GitHubPullRequest"


class GitHubPullRequest(msgspec.Struct, gc=False):
    body: str | None
    head: "GitHubPullRequestHead"
    base: "GitHubPullRequestBase"
    merge_commit_sha: str | None
    title: str
    user: GitHubUser
    draft: bool = False
    merged: bool | None = None


class GitHubPullRequestBase(msgspec.Struct, gc=False):
    ref: str
    repo: "GitHubPullRequestRepo"
    sha: str


class GitHubPullRequestHead(msgspec.Struct, gc=False):
    ref: str
    repo: Optional["GitHubPullRequestRepo"]
    sha: str


class GitHubPullRequestRepo(msgspec.Struct, gc=False):
    id: int
    private: bool


check_run_decoder = msgspec.json.Decoder(GitHubCheckRunEvent)
issue_comment_decoder = msgspec.json.Decoder(GitHubIssueCommentEvent)
pull_request_decoder = msgspec.json.Decoder(GitHubPullRequestEvent)


def deserialize_github_check_run_event(event: SubscriptionEvent) -> CheckRunEvent:
    e = check_run_decoder.decode(event["event"])

    return CheckRunEvent(
        action=e.action,
        check_run={
            "external_id": e.check_run.external_id,
            "html_url": e.check_run.html_url,
        },
        subscription_event=event,
    )


def deserialize_github_comment_event(event: SubscriptionEvent) -> CommentEvent:
    e = issue_comment_decoder.decode(event["event"])

    return CommentEvent(
        action=e.action,
        comment_type="pull_request" if e.issue.pull_request is not None else "issue",
        comment={
            "author": (
                {
                    "id": str(e.comment.user.id),
                    "username": e.comment.user.login,
                }
                if e.comment.user
                else None
            ),
            "body": e.comment.body,
            "id": str(e.comment.id),
        },
        subscription_event=event,
    )


def deserialize_github_pull_request_event(event: SubscriptionEvent) -> PullRequestEvent | None:
    e = pull_request_decoder.decode(event["event"])

    # GitHub adds new pull_request action types over time (e.g. "stacked").
    # Skip events whose action we don't recognise rather than crashing.
    if e.action not in _KNOWN_PR_ACTIONS:
        logger.info("github.webhook.pull_request.unknown_action", extra={"action": e.action})
        return None

    action: PullRequestAction = e.action  # type: ignore[assignment]
    repo = e.pull_request.head.repo or e.pull_request.base.repo

    return PullRequestEvent(
        action=action,
        pull_request={
            "author": {"id": str(e.pull_request.user.id), "username": e.pull_request.user.login},
            "base": {"ref": e.pull_request.base.ref, "sha": e.pull_request.base.sha},
            "description": e.pull_request.body,
            "draft": e.pull_request.draft,
            "head": {"ref": e.pull_request.head.ref, "sha": e.pull_request.head.sha},
            "id": str(e.number),
            "is_private_repo": repo.private,
            "repository_id": str(repo.id),
            "title": e.pull_request.title,
        },
        subscription_event=event,
    )


def deserialize_github_event_type_hint(event: SubscriptionEvent) -> EventTypeHint | None:
    if event["event_type_hint"] == "pull_request":
        return "pull_request"
    elif event["event_type_hint"] == "issue_comment":
        return "comment"
    elif event["event_type_hint"] == "check_run":
        return "check_run"
    else:
        return None


def deserialize_github_event(event: SubscriptionEvent) -> EventType | None:
    event_type_hint = deserialize_github_event_type_hint(event)
    if not event_type_hint:
        return None

    if event_type_hint == "check_run":
        return deserialize_github_check_run_event(event)
    elif event_type_hint == "comment":
        return deserialize_github_comment_event(event)
    else:
        return deserialize_github_pull_request_event(event)
