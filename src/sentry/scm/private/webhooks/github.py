import msgspec

from sentry.scm.types import SubscriptionEvent

# Existing.
# class GithubWebhookType(StrEnum):
#     INSTALLATION = "installation"
#     INSTALLATION_REPOSITORIES = "installation_repositories"
#     ISSUE = "issues"
#     PULL_REQUEST_REVIEW = "pull_request_review"
#     PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
#     PUSH = "push"


class User(msgspec.Struct):
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


class CheckRunEvent(msgspec.Struct, gc=False):
    action: str | None = None
    check_run: "CheckRun"


class CheckRun(msgspec.Struct, gc=False):
    external_id: str
    html_url: str


check_run_decoder = msgspec.json.Decoder(CheckRunEvent)


def parse_check_run_event(event: SubscriptionEvent):
    return check_run_decoder.decode(event["event"])


# $$$$$$\  $$$$$$\   $$$$$$\  $$\   $$\ $$$$$$$$\        $$$$$$\   $$$$$$\  $$\      $$\ $$\      $$\ $$$$$$$$\ $$\   $$\ $$$$$$$$\
# \_$$  _|$$  __$$\ $$  __$$\ $$ |  $$ |$$  _____|      $$  __$$\ $$  __$$\ $$$\    $$$ |$$$\    $$$ |$$  _____|$$$\  $$ |\__$$  __|
#   $$ |  $$ /  \__|$$ /  \__|$$ |  $$ |$$ |            $$ /  \__|$$ /  $$ |$$$$\  $$$$ |$$$$\  $$$$ |$$ |      $$$$\ $$ |   $$ |
#   $$ |  \$$$$$$\  \$$$$$$\  $$ |  $$ |$$$$$\          $$ |      $$ |  $$ |$$\$$\$$ $$ |$$\$$\$$ $$ |$$$$$\    $$ $$\$$ |   $$ |
#   $$ |   \____$$\  \____$$\ $$ |  $$ |$$  __|         $$ |      $$ |  $$ |$$ \$$$  $$ |$$ \$$$  $$ |$$  __|   $$ \$$$$ |   $$ |
#   $$ |  $$\   $$ |$$\   $$ |$$ |  $$ |$$ |            $$ |  $$\ $$ |  $$ |$$ |\$  /$$ |$$ |\$  /$$ |$$ |      $$ |\$$$ |   $$ |
# $$$$$$\ \$$$$$$  |\$$$$$$  |\$$$$$$  |$$$$$$$$\       \$$$$$$  | $$$$$$  |$$ | \_/ $$ |$$ | \_/ $$ |$$$$$$$$\ $$ | \$$ |   $$ |
# \______| \______/  \______/  \______/ \________|       \______/  \______/ \__|     \__|\__|     \__|\________|\__|  \__|   \__|


class GitHubIssueCommentEvent(msgspec.Struct, gc=False):
    action: str
    comment: "IssueComment"
    issue: "Issue"


class IssueComment(msgspec.Struct, gc=False):
    id: int
    body: str | None = None


class Issue(msgspec.Struct, gc=False):
    number: int
    pull_request: "IssueCommentPullRequest" | None = None


class IssueCommentPullRequest(msgspec.Struct, gc=False): ...


issue_comment_decoder = msgspec.json.Decoder(GitHubIssueCommentEvent)


def parse_issue_comment_event(event: SubscriptionEvent):
    return issue_comment_decoder.decode(event["event"])


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
    action: str
    number: int
    pull_request: "PullRequest"


class PullRequest(msgspec.Struct, gc=False):
    body: str | None
    head: "PullRequestHead"
    base: "PullRequestHead"
    merge_commit_sha: str | None
    merged: bool | None = None
    title: str
    user: User


class PullRequestHead(msgspec.Struct, gc=False):
    name: str
    repo: "PullRequestHeadRepo"
    sha: str


class PullRequestHeadRepo(msgspec.Struct, gc=False):
    private: bool


pull_request_decoder = msgspec.json.Decoder(GitHubPullRequestEvent)


def parse_pull_request_event(event: SubscriptionEvent):
    return pull_request_decoder.decode(event["event"])
