from __future__ import annotations

import logging

from sentry.integrations.github.client import GitHubAppsClient
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.tasks.integrations.github.pr_comment import RATE_LIMITED_MESSAGE, GithubAPIErrorType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

OPEN_PR_METRIC_BASE = "github_open_pr_comment.{key}"

# Caps the number of files that can be modified in a PR to leave a comment
OPEN_PR_MAX_FILES_CHANGED = 7
# Caps the number of lines that can be modified in a PR to leave a comment
OPEN_PR_MAX_LINES_CHANGED = 500


# TODO(cathy): Change the client typing to allow for multiple SCM Integrations
def safe_for_comment(
    gh_client: GitHubAppsClient, repository: Repository, pull_request: PullRequest
) -> bool:
    try:
        pullrequest_resp = gh_client.get_pullrequest(
            repo=repository.name, pull_number=pull_request.key
        )
    except ApiError as e:
        if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
            metrics.incr(
                OPEN_PR_METRIC_BASE.format(key="api_error"),
                tags={"type": GithubAPIErrorType.RATE_LIMITED.value, "code": e.code},
            )
        elif e.code == 404:
            metrics.incr(
                OPEN_PR_METRIC_BASE.format(key="api_error"),
                tags={"type": GithubAPIErrorType.MISSING_PULL_REQUEST.value, "code": e.code},
            )
        else:
            metrics.incr(
                OPEN_PR_METRIC_BASE.format(key="api_error"),
                tags={"type": GithubAPIErrorType.UNKNOWN.value, "code": e.code},
            )
            logger.exception("github.open_pr_comment.unknown_api_error")
        return False

    safe_to_comment = True
    if pullrequest_resp["state"] != "open":
        metrics.incr(
            OPEN_PR_METRIC_BASE.format(key="rejected_comment"), tags={"reason": "incorrect_state"}
        )
        safe_to_comment = False
    if pullrequest_resp["changed_files"] > OPEN_PR_MAX_FILES_CHANGED:
        metrics.incr(
            OPEN_PR_METRIC_BASE.format(key="rejected_comment"), tags={"reason": "too_many_files"}
        )
        safe_to_comment = False
    if pullrequest_resp["additions"] + pullrequest_resp["deletions"] > OPEN_PR_MAX_LINES_CHANGED:
        metrics.incr(
            OPEN_PR_METRIC_BASE.format(key="rejected_comment"), tags={"reason": "too_many_lines"}
        )
        safe_to_comment = False
    return safe_to_comment


def get_pr_filenames(
    gh_client: GitHubAppsClient, repository: Repository, pull_request: PullRequest
):
    pr_files = gh_client.get_pullrequest_files(repo=repository.name, pull_number=pull_request.key)

    # new files will not have sentry issues associated with them
    pr_filenames = [file["filename"] for file in pr_files if file["status"] != "added"]
    return pr_filenames
