from __future__ import annotations

import logging
from typing import List, Set, Tuple

from django.db.models import Value
from django.db.models.functions import StrIndex

from sentry.integrations.github.client import GitHubAppsClient
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
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
            logger.exception("github.open_pr_comment.unknown_api_error", extra={"error": str(e)})
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
) -> List[str]:
    pr_files = gh_client.get_pullrequest_files(repo=repository.name, pull_number=pull_request.key)

    # new files will not have sentry issues associated with them
    pr_filenames: List[str] = [file["filename"] for file in pr_files if file["status"] != "added"]
    return pr_filenames


def get_projects_and_filenames_from_source_file(
    org_id: int,
    pr_filename: str,
) -> Tuple[Set[Project], Set[str]]:
    # fetch the code mappings in which the source_root is a substring at the start of pr_filename
    code_mappings = (
        RepositoryProjectPathConfig.objects.filter(organization_id=org_id)
        .annotate(substring_match=StrIndex(Value(pr_filename), "source_root"))
        .filter(substring_match=1)
    )

    project_list: Set[Project] = set()
    sentry_filenames = set()

    if len(code_mappings):
        for code_mapping in code_mappings:
            project_list.add(code_mapping.project)
            sentry_filenames.add(
                pr_filename.replace(code_mapping.source_root, code_mapping.stack_root)
            )
    return project_list, sentry_filenames
