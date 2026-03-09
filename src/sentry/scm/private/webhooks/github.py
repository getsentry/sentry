import msgspec

from sentry.scm.types import (
    CheckRunAction,
    CheckRunEvent,
    CommentAction,
    CommentEvent,
    EventType,
    EventTypeHint,
    PullRequestAction,
    PullRequestEvent,
    SubscriptionEvent,
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
    action: PullRequestAction
    number: int
    pull_request: "GitHubPullRequest"


class GitHubPullRequest(msgspec.Struct, gc=False):
    body: str | None
    head: "GitHubPullRequestHead"
    base: "GitHubPullRequestBase"
    merge_commit_sha: str | None
    title: str
    user: GitHubUser
    merged: bool | None = None


class GitHubPullRequestBase(msgspec.Struct, gc=False):
    ref: str
    repo: "GitHubPullRequestRepo"
    sha: str


class GitHubPullRequestHead(msgspec.Struct, gc=False):
    ref: str
    repo: "GitHubPullRequestRepo" | None
    sha: str


class GitHubPullRequestRepo(msgspec.Struct, gc=False):
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


def deserialize_github_pull_request_event(event: SubscriptionEvent) -> PullRequestEvent:
    e = pull_request_decoder.decode(event["event"])

    repo = e.pull_request.head.repo or e.pull_request.base.repo

    return PullRequestEvent(
        action=e.action,
        pull_request={
            "author": {"id": str(e.pull_request.user.id), "username": e.pull_request.user.login},
            "base": {"ref": e.pull_request.base.ref, "sha": e.pull_request.base.sha},
            "description": e.pull_request.body,
            "head": {"ref": e.pull_request.head.ref, "sha": e.pull_request.head.sha},
            "id": str(e.number),
            "is_private_repo": repo.private,
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
