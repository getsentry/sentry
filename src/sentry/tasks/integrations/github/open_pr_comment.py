from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, List, Set, Tuple

from django.db.models import Value
from django.db.models.functions import StrIndex
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry.integrations.github.client import GitHubAppsClient
from sentry.models.group import Group
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.integrations.github.pr_comment import RATE_LIMITED_MESSAGE, GithubAPIErrorType
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

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


def get_top_5_issues_by_count_for_file(
    projects: List[Project], sentry_filenames: List[str]
) -> list[dict[str, Any]]:
    """Given a list of issue group ids, return a sublist of the top 5 ordered by event count"""
    group_ids = list(
        Group.objects.filter(
            last_seen__gte=datetime.now() - timedelta(days=14),
            project__in=projects,
        ).values_list("id", flat=True)
    )
    project_ids = [p.id for p in projects]

    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        tenant_ids={"organization_id": projects[0].organization_id},
        query=(
            Query(Entity("events"))
            .set_select(
                [
                    Column("group_id"),
                    Function("count", [], "event_count"),
                    Column("exception_frames.filename"),
                ]
            )
            .set_groupby([Column("group_id"), Column("exception_frames.filename")])
            .set_where(
                [
                    Condition(Column("project_id"), Op.IN, project_ids),
                    Condition(Column("group_id"), Op.IN, group_ids),
                    Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=30)),
                    Condition(Column("timestamp"), Op.LT, datetime.now()),
                    Condition(
                        Function("arrayElement", (Column("exception_frames.filename"), -1)),
                        Op.IN,
                        sentry_filenames,
                    ),
                ]
            )
            .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
            .set_limit(5)
        ),
    )
    return raw_snql_query(request, referrer=Referrer.GITHUB_PR_COMMENT_BOT.value)["data"]
