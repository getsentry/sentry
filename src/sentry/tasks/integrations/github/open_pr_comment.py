from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Set, Tuple

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
from sentry.tasks.integrations.github.pr_comment import (
    RATE_LIMITED_MESSAGE,
    GithubAPIErrorType,
    PullRequestIssue,
    format_comment_subtitle,
    format_comment_url,
)
from sentry.templatetags.sentry_helpers import small_count
from sentry.types.referrer_ids import GITHUB_OPEN_PR_BOT_REFERRER
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

OPEN_PR_METRIC_BASE = "github_open_pr_comment.{key}"

# Caps the number of files that can be modified in a PR to leave a comment
OPEN_PR_MAX_FILES_CHANGED = 7
# Caps the number of lines that can be modified in a PR to leave a comment
OPEN_PR_MAX_LINES_CHANGED = 500

COMMENT_BODY_TEMPLATE = """## 🚀 Sentry Issue Report
You modified these files in this pull request and we noticed these issues associated with them.

{issue_tables}
---

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""

ISSUE_TABLE_TEMPLATE = """📄 **{filename}**

| Issue  | Additional Info |
| :---------: | :--------: |
{issue_rows}"""

ISSUE_TABLE_TOGGLE_TEMPLATE = """<details>
<summary><b>📄 {filename} (Click to Expand)</b></summary>

| Issue  | Additional Info |
| :---------: | :--------: |
{issue_rows}
</details>"""

ISSUE_ROW_TEMPLATE = "| ‼️ [**{title}**]({url}) {subtitle} | `Handled:` **{is_handled}** `Event Count:` **{event_count}** `Users:` **{affected_users}** |"


def format_open_pr_comment(issue_tables: List[str]) -> str:
    return COMMENT_BODY_TEMPLATE.format(issue_tables="\n".join(issue_tables))


# for a single file, create a table
def format_issue_table(diff_filename: str, issues: List[PullRequestIssue], toggle=False) -> str:
    issue_rows = "\n".join(
        [
            ISSUE_ROW_TEMPLATE.format(
                title=issue.title,
                subtitle=format_comment_subtitle(issue.subtitle),
                url=format_comment_url(issue.url, GITHUB_OPEN_PR_BOT_REFERRER),
                is_handled=str(issue.is_handled),
                event_count=small_count(issue.event_count),
                affected_users=small_count(issue.affected_users),
            )
            for issue in issues
        ]
    )

    if toggle:
        return ISSUE_TABLE_TOGGLE_TEMPLATE.format(filename=diff_filename, issue_rows=issue_rows)

    return ISSUE_TABLE_TEMPLATE.format(filename=diff_filename, issue_rows=issue_rows)


# for a single file, get the contents
def get_issue_table_contents(issue_list: Dict[str, int]) -> List[PullRequestIssue]:
    group_id_to_info = {}
    for issue in issue_list:
        group_id = issue.pop("group_id")
        group_id_to_info[group_id] = issue

    issues = Group.objects.filter(id__in=list(group_id_to_info.keys())).all()
    return [
        PullRequestIssue(
            title=issue.title,
            subtitle=issue.culprit,
            url=issue.get_absolute_url(),
            affected_users=group_id_to_info[issue.id]["affected_users"],
            event_count=group_id_to_info[issue.id]["event_count"],
            is_handled=bool(group_id_to_info[issue.id]["is_handled"]),
        )
        for issue in issues
    ]


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
                    Function("uniq", [Column("user_hash")], "affected_users"),
                    Function("isHandled", [], "is_handled"),
                ]
            )
            .set_groupby([Column("group_id"), Column("exception_stacks.mechanism_handled")])
            .set_where(
                [
                    Condition(Column("project_id"), Op.IN, project_ids),
                    Condition(Column("group_id"), Op.IN, group_ids),
                    Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=14)),
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
