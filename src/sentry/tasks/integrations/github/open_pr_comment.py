from __future__ import annotations

import itertools
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Set, Tuple

from django.db.models import Value
from django.db.models.functions import StrIndex
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry.integrations.github.client import GitHubAppsClient
from sentry.models.group import Group, GroupStatus
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import CommentType, PullRequest
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.github.pr_comment import (
    ISSUE_LOCKED_ERROR_MESSAGE,
    RATE_LIMITED_MESSAGE,
    GithubAPIErrorType,
    PullRequestIssue,
    create_or_update_comment,
    format_comment_url,
    get_pr_comment,
)
from sentry.templatetags.sentry_helpers import small_count
from sentry.types.referrer_ids import GITHUB_OPEN_PR_BOT_REFERRER
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

OPEN_PR_METRICS_BASE = "github_open_pr_comment.{key}"


@dataclass
class PullRequestFile:
    filename: str
    patch: str


# Caps the number of files that can be modified in a PR to leave a comment
OPEN_PR_MAX_FILES_CHANGED = 7
# Caps the number of lines that can be modified in a PR to leave a comment
OPEN_PR_MAX_LINES_CHANGED = 500

COMMENT_BODY_TEMPLATE = """## 🔍 Existing Issues For Review
Your pull request is modifying functions with the following pre-existing issues:

{issue_tables}
---

<sub>Did you find this useful? React with a 👍 or 👎 or let us know in #proj-github-pr-comments</sub>"""

ISSUE_TABLE_TEMPLATE = """📄 File: **{filename}**

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}"""

ISSUE_TABLE_TOGGLE_TEMPLATE = """<details>
<summary><b>📄 File: {filename} (Click to Expand)</b></summary>

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}
</details>"""

ISSUE_ROW_TEMPLATE = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

ISSUE_DESCRIPTION_LENGTH = 52


def format_open_pr_comment(issue_tables: List[str]) -> str:
    return COMMENT_BODY_TEMPLATE.format(issue_tables="\n".join(issue_tables))


def format_open_pr_comment_subtitle(title_length, subtitle):
    # the title length + " " + subtitle should be <= 52
    subtitle_length = ISSUE_DESCRIPTION_LENGTH - title_length - 1
    return subtitle[: subtitle_length - 3] + "..." if len(subtitle) > subtitle_length else subtitle


# for a single file, create a table
def format_issue_table(diff_filename: str, issues: List[PullRequestIssue], toggle=False) -> str:
    issue_rows = "\n".join(
        [
            ISSUE_ROW_TEMPLATE.format(
                title=issue.title,
                subtitle=format_open_pr_comment_subtitle(len(issue.title), issue.subtitle),
                url=format_comment_url(issue.url, GITHUB_OPEN_PR_BOT_REFERRER),
                event_count=small_count(issue.event_count),
                function_name=issue.function_name,
            )
            for issue in issues
        ]
    )

    if toggle:
        return ISSUE_TABLE_TOGGLE_TEMPLATE.format(filename=diff_filename, issue_rows=issue_rows)

    return ISSUE_TABLE_TEMPLATE.format(filename=diff_filename, issue_rows=issue_rows)


# for a single file, get the contents
def get_issue_table_contents(issue_list: List[Dict[str, Any]]) -> List[PullRequestIssue]:
    group_id_to_info = {}
    for issue in issue_list:
        group_id = issue["group_id"]
        group_id_to_info[group_id] = dict(filter(lambda k: k[0] != "group_id", issue.items()))

    issues = Group.objects.filter(id__in=list(group_id_to_info.keys())).all()

    pull_request_issues = [
        PullRequestIssue(
            title=issue.title,
            subtitle=issue.culprit,
            url=issue.get_absolute_url(),
            affected_users=issue.count_users_seen(),
            event_count=group_id_to_info[issue.id]["event_count"],
            function_name=group_id_to_info[issue.id]["function_name"],
        )
        for issue in issues
    ]
    pull_request_issues.sort(key=lambda k: k.event_count or 0, reverse=True)

    return pull_request_issues


# TODO(cathy): Change the client typing to allow for multiple SCM Integrations
def safe_for_comment(
    gh_client: GitHubAppsClient, repository: Repository, pull_request: PullRequest
) -> List[Dict[str, str]]:
    logger.info("github.open_pr_comment.check_safe_for_comment")
    try:
        pr_files = gh_client.get_pullrequest_files(
            repo=repository.name, pull_number=pull_request.key
        )
    except ApiError as e:
        logger.info("github.open_pr_comment.api_error")
        if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(key="api_error"),
                tags={"type": GithubAPIErrorType.RATE_LIMITED.value, "code": e.code},
            )
        elif e.code == 404:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(key="api_error"),
                tags={"type": GithubAPIErrorType.MISSING_PULL_REQUEST.value, "code": e.code},
            )
        else:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(key="api_error"),
                tags={"type": GithubAPIErrorType.UNKNOWN.value, "code": e.code},
            )
            logger.exception("github.open_pr_comment.unknown_api_error", extra={"error": str(e)})
        return []

    changed_file_count = 0
    changed_lines_count = 0
    filtered_pr_files = []

    for file in pr_files:
        filename = file["filename"]
        # don't count the file if it was added or is not a Python file
        if file["status"] == "added" or not filename.endswith(".py"):
            continue

        changed_file_count += 1
        changed_lines_count += file["changes"]
        filtered_pr_files.append(file)

        if changed_file_count > OPEN_PR_MAX_FILES_CHANGED:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(key="rejected_comment"),
                tags={"reason": "too_many_files"},
            )
            return []
        if changed_lines_count > OPEN_PR_MAX_LINES_CHANGED:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(key="rejected_comment"),
                tags={"reason": "too_many_lines"},
            )
            return []

    return filtered_pr_files


def get_pr_files(pr_files: List[Dict[str, str]]) -> List[PullRequestFile]:
    # new files will not have sentry issues associated with them
    # only fetch Python files
    pullrequest_files = [
        PullRequestFile(filename=file["filename"], patch=file["patch"]) for file in pr_files
    ]

    logger.info("github.open_pr_comment.pr_filenames", extra={"count": len(pullrequest_files)})

    return pullrequest_files


# currently Python only
def get_file_functions(patch: str) -> Set[str]:
    r"""
    Function header regex pattern
    ^           - Asserts the start of a line.
    @@.*@@      - Matches a string that starts with two "@" characters, followed by any characters
                (except newline), and ends with two "@" characters.
    \s+         - Matches one or more whitespace characters (spaces, tabs, etc.).
    def         - Matches the literal characters "def".
    \\s+         - Matches one or more whitespace characters.
    (?P<fnc>.*) - This is a named capturing group that captures any characters (except newline)
                and assigns them to the named group "fnc".
    \(          - Matches an opening parenthesis "(".
    .*          - Matches any characters (except newline).
    $           - Asserts the end of a line.
    """

    python_function_regex = r"^@@.*@@\s+def\s+(?P<fnc>.*)\(.*$"
    return set(re.findall(python_function_regex, patch, flags=re.M))


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
                pr_filename.replace(code_mapping.source_root, code_mapping.stack_root, 1)
            )
    return project_list, sentry_filenames


def get_top_5_issues_by_count_for_file(
    projects: List[Project], sentry_filenames: List[str], function_names: List[str]
) -> List[Dict[str, Any]]:
    """Given a list of issue group ids, return a sublist of the top 5 ordered by event count"""
    group_ids = list(
        Group.objects.filter(
            first_seen__gte=datetime.now() - timedelta(days=90),
            last_seen__gte=datetime.now() - timedelta(days=14),
            status=GroupStatus.UNRESOLVED,
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
                    Function(
                        "arrayElement", (Column("exception_frames.function"), -1), "function_name"
                    ),
                ]
            )
            .set_groupby(
                [
                    Column("group_id"),
                    Column("exception_stacks.mechanism_handled"),
                    Column("exception_frames.function"),
                ]
            )
            .set_where(
                [
                    Condition(Column("project_id"), Op.IN, project_ids),
                    Condition(Column("group_id"), Op.IN, group_ids),
                    Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=14)),
                    Condition(Column("timestamp"), Op.LT, datetime.now()),
                    # NOTE: this currently looks at the top frame of the stack trace (old suspect commit logic)
                    Condition(
                        Function("arrayElement", (Column("exception_frames.filename"), -1)),
                        Op.IN,
                        sentry_filenames,
                    ),
                    Condition(
                        Function("arrayElement", (Column("exception_frames.function"), -1)),
                        Op.IN,
                        function_names,
                    ),
                    Condition(Function("notHandled", []), Op.EQ, 1),
                ]
            )
            .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
            .set_limit(5)
        ),
    )
    return raw_snql_query(request, referrer=Referrer.GITHUB_PR_COMMENT_BOT.value)["data"]


@instrumented_task(
    name="sentry.tasks.integrations.open_pr_comment_workflow", silo_mode=SiloMode.REGION
)
def open_pr_comment_workflow(pr_id: int) -> None:
    logger.info("github.open_pr_comment.start_workflow")

    # CHECKS
    # check PR exists to get PR key
    try:
        pull_request = PullRequest.objects.get(id=pr_id)
    except PullRequest.DoesNotExist:
        logger.info("github.open_pr_comment.pr_missing")
        metrics.incr(OPEN_PR_METRICS_BASE.format(key="error"), tags={"type": "missing_pr"})
        return

    # check org option
    org_id = pull_request.organization_id
    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        logger.exception("github.open_pr_comment.org_missing")
        metrics.incr(OPEN_PR_METRICS_BASE.format(key="error"), tags={"type": "missing_org"})
        return

    if not OrganizationOption.objects.get_value(
        organization=organization,
        key="sentry:github_open_pr_bot",
        default=True,
    ):
        logger.info("github.open_pr_comment.option_missing", extra={"organization_id": org_id})
        return

    # check PR repo exists to get repo name
    try:
        repo = Repository.objects.get(id=pull_request.repository_id)
    except Repository.DoesNotExist:
        logger.info("github.open_pr_comment.repo_missing", extra={"organization_id": org_id})
        metrics.incr(OPEN_PR_METRICS_BASE.format(key="error"), tags={"type": "missing_repo"})
        return

    # check integration exists to hit Github API with client
    integration = integration_service.get_integration(integration_id=repo.integration_id)
    if not integration:
        logger.info("github.open_pr_comment.integration_missing", extra={"organization_id": org_id})
        metrics.incr(OPEN_PR_METRICS_BASE.format(key="error"), tags={"type": "missing_integration"})
        return

    installation = integration.get_installation(organization_id=org_id)

    client = installation.get_client()

    # CREATING THE COMMENT

    # fetch the files in the PR and determine if it is safe to comment
    pr_files = safe_for_comment(gh_client=client, repository=repo, pull_request=pull_request)

    if len(pr_files) == 0:
        logger.info(
            "github.open_pr_comment.not_safe_for_comment", extra={"file_count": len(pr_files)}
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(key="error"),
            tags={"type": "unsafe_for_comment"},
        )
        return

    pullrequest_files = get_pr_files(pr_files)

    issue_table_contents = {}
    top_issues_per_file = []

    # fetch issues related to the files
    for file in pullrequest_files:
        projects, sentry_filenames = get_projects_and_filenames_from_source_file(
            org_id, file.filename
        )
        if not len(projects) or not len(sentry_filenames):
            continue

        function_names = get_file_functions(file.patch)

        if not len(function_names):
            continue

        top_issues = get_top_5_issues_by_count_for_file(
            list(projects), list(sentry_filenames), list(function_names)
        )
        if not len(top_issues):
            continue

        top_issues_per_file.append(top_issues)

        issue_table_contents[file.filename] = get_issue_table_contents(top_issues)

    if not len(issue_table_contents):
        logger.info("github.open_pr_comment.no_issues")
        # don't leave a comment if no issues for files in PR
        metrics.incr(OPEN_PR_METRICS_BASE.format(key="no_issues"))
        return

    # format issues per file into comment
    issue_tables = []
    first_table = True
    for file in pullrequest_files:
        pr_filename = file.filename
        issue_table_content = issue_table_contents.get(pr_filename, None)

        if issue_table_content is None:
            continue

        if first_table:
            issue_table = format_issue_table(pr_filename, issue_table_content)
            first_table = False
        else:
            # toggle all tables but the first one
            issue_table = format_issue_table(pr_filename, issue_table_content, toggle=True)

        issue_tables.append(issue_table)

    comment_body = format_open_pr_comment(issue_tables)

    # list all issues in the comment
    issue_list: List[Dict[str, Any]] = list(itertools.chain.from_iterable(top_issues_per_file))
    issue_id_list: List[int] = [issue["group_id"] for issue in issue_list]

    pr_comment = get_pr_comment(pr_id, comment_type=CommentType.OPEN_PR)

    try:
        create_or_update_comment(
            pr_comment=pr_comment,
            client=client,
            repo=repo,
            pr_key=pull_request.key,
            comment_body=comment_body,
            pullrequest_id=pull_request.id,
            issue_list=issue_id_list,
            comment_type=CommentType.OPEN_PR,
            metrics_base=OPEN_PR_METRICS_BASE,
        )
    except ApiError as e:
        if e.json:
            if ISSUE_LOCKED_ERROR_MESSAGE in e.json.get("message", ""):
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(key="error"),
                    tags={"type": "issue_locked_error"},
                )
                return

            elif RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(key="error"),
                    tags={"type": "rate_limited_error"},
                )
                return

        metrics.incr(OPEN_PR_METRICS_BASE.format(key="error"), tags={"type": "api_error"})
        raise e
