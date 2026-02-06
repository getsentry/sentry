import msgspec

from sentry.scm.types import (
    CheckRunAction,
    CheckRunEvent,
    CommentAction,
    CommentEvent,
    PullRequestAction,
    PullRequestEvent,
    SubscriptionEvent,
)

# Existing.
# class GithubWebhookType(StrEnum):
#     INSTALLATION = "installation"
#     INSTALLATION_REPOSITORIES = "installation_repositories"
#     ISSUE = "issues"
#     PULL_REQUEST_REVIEW = "pull_request_review"
#     PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
#     PUSH = "push"


class GitHubUser(msgspec.Struct):
    id: int
    login: str  # Username
    type: str | None = None


#  $$$$$$\  $$\   $$\ $$$$$$$$\  $$$$$$\  $$\   $$\       $$$$$$$\  $$\   $$\ $$\   $$\
# $$  __$$\ $$ |  $$ |$$  _____|$$  __$$\ $$ | $$  |      $$  __$$\ $$ |  $$ |$$$\  $$ |
# $$ /  \__|$$ |  $$ |$$ |      $$ /  \__|$$ |$$  /       $$ |  $$ |$$ |  $$ |$$$$\ $$ |
# $$ |      $$$$$$$$ |$$$$$\    $$ |      $$$$$  /        $$$$$$$  |$$ |  $$ |$$ $$\$$ |
# $$ |      $$  __$$ |$$  __|   $$ |      $$  $$<         $$  __$$< $$ |  $$ |$$ \$$$$ |
# $$ |  $$\ $$ |  $$ |$$ |      $$ |  $$\ $$ |\$$\        $$ |  $$ |$$ |  $$ |$$ |\$$$ |
# \$$$$$$  |$$ |  $$ |$$$$$$$$\ \$$$$$$  |$$ | \$$\       $$ |  $$ |\$$$$$$  |$$ | \$$ |
#  \______/ \__|  \__|\________| \______/ \__|  \__|      \__|  \__| \______/ \__|  \__|


class GitHubCheckRunEvent(msgspec.Struct, gc=False):
    action: CheckRunAction
    check_run: "GitHubCheckRun"


class GitHubCheckRun(msgspec.Struct, gc=False):
    external_id: str
    html_url: str


check_run_decoder = msgspec.json.Decoder(GitHubCheckRunEvent)


def parse_github_check_run_event(event: SubscriptionEvent) -> CheckRunEvent:
    e = check_run_decoder.decode(event["event"])

    return {
        "action": e.action,
        "check_run": {
            "external_id": e.check_run.external_id,
            "html_url": e.check_run.html_url,
        },
    }


#  $$$$$$\   $$$$$$\  $$\      $$\ $$\      $$\ $$$$$$$$\ $$\   $$\ $$$$$$$$\
# $$  __$$\ $$  __$$\ $$$\    $$$ |$$$\    $$$ |$$  _____|$$$\  $$ |\__$$  __|
# $$ /  \__|$$ /  $$ |$$$$\  $$$$ |$$$$\  $$$$ |$$ |      $$$$\ $$ |   $$ |
# $$ |      $$ |  $$ |$$\$$\$$ $$ |$$\$$\$$ $$ |$$$$$\    $$ $$\$$ |   $$ |
# $$ |      $$ |  $$ |$$ \$$$  $$ |$$ \$$$  $$ |$$  __|   $$ \$$$$ |   $$ |
# $$ |  $$\ $$ |  $$ |$$ |\$  /$$ |$$ |\$  /$$ |$$ |      $$ |\$$$ |   $$ |
# \$$$$$$  | $$$$$$  |$$ | \_/ $$ |$$ | \_/ $$ |$$$$$$$$\ $$ | \$$ |   $$ |
#  \______/  \______/ \__|     \__|\__|     \__|\________|\__|  \__|   \__|


class GitHubIssueCommentEvent(msgspec.Struct, gc=False):
    action: CommentAction
    comment: "GitHubIssueComment"
    issue: "GitHubIssue"


class GitHubIssueComment(msgspec.Struct, gc=False):
    id: int
    body: str | None = None
    user: GitHubUser | None


class GitHubIssue(msgspec.Struct, gc=False):
    number: int
    pull_request: "GitHubIssueCommentPullRequest" | None = None


class GitHubIssueCommentPullRequest(msgspec.Struct, gc=False):
    pass


issue_comment_decoder = msgspec.json.Decoder(GitHubIssueCommentEvent)


def parse_github_comment_event(event: SubscriptionEvent) -> CommentEvent:
    e = issue_comment_decoder.decode(event["event"])

    return {
        "action": e.action,
        "comment_type": "pull_request" if e.issue.pull_request is not None else "issue",
        "comment": {
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
            # TODO: REMOVE THESE
            "provider": "github",
            "raw": {},
        },
        "subscription_event": event,
    }


# $$$$$$$\  $$\   $$\ $$\       $$\             $$$$$$$\  $$$$$$$$\  $$$$$$\  $$\   $$\ $$$$$$$$\  $$$$$$\ $$$$$$$$\
# $$  __$$\ $$ |  $$ |$$ |      $$ |            $$  __$$\ $$  _____|$$  __$$\ $$ |  $$ |$$  _____|$$  __$$\\__$$  __|
# $$ |  $$ |$$ |  $$ |$$ |      $$ |            $$ |  $$ |$$ |      $$ /  $$ |$$ |  $$ |$$ |      $$ /  \__|  $$ |
# $$$$$$$  |$$ |  $$ |$$ |      $$ |            $$$$$$$  |$$$$$\    $$ |  $$ |$$ |  $$ |$$$$$\    \$$$$$$\    $$ |
# $$  ____/ $$ |  $$ |$$ |      $$ |            $$  __$$< $$  __|   $$ |  $$ |$$ |  $$ |$$  __|    \____$$\   $$ |
# $$ |      $$ |  $$ |$$ |      $$ |            $$ |  $$ |$$ |      $$ $$\$$ |$$ |  $$ |$$ |      $$\   $$ |  $$ |
# $$ |      \$$$$$$  |$$$$$$$$\ $$$$$$$$\       $$ |  $$ |$$$$$$$$\ \$$$$$$ / \$$$$$$  |$$$$$$$$\ \$$$$$$  |  $$ |
# \__|       \______/ \________|\________|      \__|  \__|\________| \___$$$\  \______/ \________| \______/   \__|
#                                                                        \___|


class GitHubPullRequestEvent(msgspec.Struct, gc=False):
    action: PullRequestAction
    number: int
    pull_request: "GitHubPullRequest"


class GitHubPullRequest(msgspec.Struct, gc=False):
    body: str | None
    head: "GitHubPullRequestHead"
    base: "GitHubPullRequestHead"
    merge_commit_sha: str | None
    merged: bool | None = None
    title: str
    user: GitHubUser


class GitHubPullRequestHead(msgspec.Struct, gc=False):
    ref: str
    repo: "GitHubPullRequestHeadRepo"
    sha: str


class GitHubPullRequestHeadRepo(msgspec.Struct, gc=False):
    private: bool


pull_request_decoder = msgspec.json.Decoder(GitHubPullRequestEvent)


def parse_github_pull_request_event(event: SubscriptionEvent) -> PullRequestEvent:
    e = pull_request_decoder.decode(event["event"])

    return {
        "action": e.action,
        "pull_request": {
            "author": {"id": e.pull_request.user.id, "username": e.pull_request.user.login},
            "base": {"name": e.pull_request.base.ref, "sha": e.pull_request.base.sha},
            "head": {"name": e.pull_request.head.ref, "sha": e.pull_request.head.sha},
            "description": e.pull_request.body,
            "id": str(e.number),
            "is_private_repo": e.pull_request.head.repo.private,
            "raw": {},  # TODO: Remove this and have Alex wrap his PR type like I have with event.
            "provider": "github",  # TODO: Remove this and have Alex wrap his PR type like I have with event.
            "title": e.pull_request.title,
        },
        "subscription_event": event,
    }
