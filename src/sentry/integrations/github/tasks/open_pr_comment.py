from __future__ import annotations

import itertools
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from django.db.models import Value
from django.db.models.functions import StrIndex
from snuba_sdk import (
    BooleanCondition,
    BooleanOp,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Op,
    OrderBy,
    Query,
)
from snuba_sdk import Request as SnubaRequest

from sentry.constants import EXTENSION_LANGUAGE_MAP, ObjectStatus
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.github.constants import (
    ISSUE_LOCKED_ERROR_MESSAGE,
    RATE_LIMITED_MESSAGE,
    STACKFRAME_COUNT,
)
from sentry.integrations.github.tasks.language_parsers import PATCH_PARSERS
from sentry.integrations.github.tasks.pr_comment import format_comment_url
from sentry.integrations.github.tasks.utils import (
    GithubAPIErrorType,
    PullRequestFile,
    PullRequestIssue,
)
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.commit_context import CommitContextIntegration
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import CommentType, PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.templatetags.sentry_helpers import small_count
from sentry.types.referrer_ids import GITHUB_OPEN_PR_BOT_REFERRER
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

OPEN_PR_METRICS_BASE = "{integration}.open_pr_comment.{key}"

# Caps the number of files that can be modified in a PR to leave a comment
OPEN_PR_MAX_FILES_CHANGED = 7
# Caps the number of lines that can be modified in a PR to leave a comment
OPEN_PR_MAX_LINES_CHANGED = 500

OPEN_PR_COMMENT_BODY_TEMPLATE = """\
## 🔍 Existing Issues For Review
Your pull request is modifying functions with the following pre-existing issues:

{issue_tables}
---

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""

OPEN_PR_ISSUE_TABLE_TEMPLATE = """\
📄 File: **{filename}**

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}"""

OPEN_PR_ISSUE_TABLE_TOGGLE_TEMPLATE = """\
<details>
<summary><b>📄 File: {filename} (Click to Expand)</b></summary>

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}
</details>"""

OPEN_PR_ISSUE_DESCRIPTION_LENGTH = 52

MAX_RECENT_ISSUES = 5000


def format_open_pr_comment(issue_tables: list[str]) -> str:
    return OPEN_PR_COMMENT_BODY_TEMPLATE.format(issue_tables="\n".join(issue_tables))


def format_open_pr_comment_subtitle(title_length, subtitle):
    # the title length + " " + subtitle should be <= 52
    subtitle_length = OPEN_PR_ISSUE_DESCRIPTION_LENGTH - title_length - 1
    return subtitle[: subtitle_length - 3] + "..." if len(subtitle) > subtitle_length else subtitle


# for a single file, create a table
def format_issue_table(
    diff_filename: str, issues: list[PullRequestIssue], patch_parsers: dict[str, Any], toggle: bool
) -> str:
    language_parser = patch_parsers.get(diff_filename.split(".")[-1], None)

    if not language_parser:
        return ""

    issue_row_template = language_parser.issue_row_template

    issue_rows = "\n".join(
        [
            issue_row_template.format(
                title=issue.title,
                subtitle=format_open_pr_comment_subtitle(len(issue.title), issue.subtitle),
                url=format_comment_url(issue.url, GITHUB_OPEN_PR_BOT_REFERRER),
                event_count=small_count(issue.event_count),
                function_name=issue.function_name,
                affected_users=small_count(issue.affected_users),
            )
            for issue in issues
        ]
    )

    if toggle:
        return OPEN_PR_ISSUE_TABLE_TOGGLE_TEMPLATE.format(
            filename=diff_filename, issue_rows=issue_rows
        )

    return OPEN_PR_ISSUE_TABLE_TEMPLATE.format(filename=diff_filename, issue_rows=issue_rows)


# for a single file, get the contents
def get_issue_table_contents(issue_list: list[dict[str, Any]]) -> list[PullRequestIssue]:
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
            affected_users=issue.count_users_seen(
                referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS_OPEN_PR_COMMENT.value
            ),
            event_count=group_id_to_info[issue.id]["event_count"],
            function_name=group_id_to_info[issue.id]["function_name"],
        )
        for issue in issues
    ]
    pull_request_issues.sort(key=lambda k: k.event_count or 0, reverse=True)

    return pull_request_issues


# TODO(cathy): Change the client typing to allow for multiple SCM Integrations
def safe_for_comment(
    gh_client: GitHubApiClient, repository: Repository, pull_request: PullRequest
) -> list[dict[str, str]]:
    logger.info("github.open_pr_comment.check_safe_for_comment")
    try:
        pr_files = gh_client.get_pullrequest_files(
            repo=repository.name, pull_number=pull_request.key
        )
    except ApiError as e:
        logger.info("github.open_pr_comment.api_error")
        if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration="github", key="api_error"),
                tags={"type": GithubAPIErrorType.RATE_LIMITED.value, "code": e.code},
            )
        elif e.code == 404:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration="github", key="api_error"),
                tags={"type": GithubAPIErrorType.MISSING_PULL_REQUEST.value, "code": e.code},
            )
        else:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration="github", key="api_error"),
                tags={"type": GithubAPIErrorType.UNKNOWN.value, "code": e.code},
            )
            logger.exception("github.open_pr_comment.unknown_api_error", extra={"error": str(e)})
        return []

    changed_file_count = 0
    changed_lines_count = 0
    filtered_pr_files = []

    patch_parsers = PATCH_PARSERS
    # NOTE: if we are testing beta patch parsers, add check here

    for file in pr_files:
        filename = file["filename"]
        # we only count the file if it's modified and if the file extension is in the list of supported file extensions
        # we cannot look at deleted or newly added files because we cannot extract functions from the diffs
        if file["status"] != "modified" or filename.split(".")[-1] not in patch_parsers:
            continue

        changed_file_count += 1
        changed_lines_count += file["changes"]
        filtered_pr_files.append(file)

        if changed_file_count > OPEN_PR_MAX_FILES_CHANGED:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration="github", key="rejected_comment"),
                tags={"reason": "too_many_files"},
            )
            return []
        if changed_lines_count > OPEN_PR_MAX_LINES_CHANGED:
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration="github", key="rejected_comment"),
                tags={"reason": "too_many_lines"},
            )
            return []

    return filtered_pr_files


def get_pr_files(pr_files: list[dict[str, str]]) -> list[PullRequestFile]:
    # new files will not have sentry issues associated with them
    # only fetch Python files
    pullrequest_files = [
        PullRequestFile(filename=file["filename"], patch=file["patch"])
        for file in pr_files
        if "patch" in file
    ]

    logger.info("github.open_pr_comment.pr_filenames", extra={"count": len(pullrequest_files)})

    return pullrequest_files


def get_projects_and_filenames_from_source_file(
    org_id: int,
    repo_id: int,
    pr_filename: str,
) -> tuple[set[Project], set[str]]:
    # fetch the code mappings in which the source_root is a substring at the start of pr_filename
    code_mappings = (
        RepositoryProjectPathConfig.objects.filter(
            organization_id=org_id,
            repository_id=repo_id,
        )
        .annotate(substring_match=StrIndex(Value(pr_filename), "source_root"))
        .filter(substring_match=1)
    )

    project_list: set[Project] = set()
    sentry_filenames = set()

    if len(code_mappings):
        for code_mapping in code_mappings:
            project_list.add(code_mapping.project)
            sentry_filenames.add(
                pr_filename.replace(code_mapping.source_root, code_mapping.stack_root, 1)
            )
    return project_list, sentry_filenames


def get_top_5_issues_by_count_for_file(
    projects: list[Project], sentry_filenames: list[str], function_names: list[str]
) -> list[dict[str, Any]]:
    """
    Given a list of projects, Github filenames reverse-codemapped into filenames in Sentry,
    and function names representing the list of functions changed in a PR file, return a
    sublist of the top 5 recent unhandled issues ordered by event count.
    """
    if not len(projects):
        return []

    patch_parsers = PATCH_PARSERS
    # NOTE: if we are testing beta patch parsers, add check here

    # fetches the appropriate parser for formatting the snuba query given the file extension
    # the extension is never replaced in reverse codemapping
    language_parser = patch_parsers.get(sentry_filenames[0].split(".")[-1], None)

    if not language_parser:
        return []

    group_ids = list(
        Group.objects.filter(
            first_seen__gte=datetime.now(UTC) - timedelta(days=90),
            last_seen__gte=datetime.now(UTC) - timedelta(days=14),
            status=GroupStatus.UNRESOLVED,
            project__in=projects,
        )
        .order_by("-times_seen")
        .values_list("id", flat=True)
    )[:MAX_RECENT_ISSUES]
    project_ids = [p.id for p in projects]

    multi_if = language_parser.generate_multi_if(function_names)

    # fetch the count of events for each group_id
    subquery = (
        Query(Entity("events"))
        .set_select(
            [
                Column("title"),
                Column("culprit"),
                Column("group_id"),
                Function("count", [], "event_count"),
                Function(
                    "multiIf",
                    multi_if,
                    "function_name",
                ),
            ]
        )
        .set_groupby(
            [
                Column("title"),
                Column("culprit"),
                Column("group_id"),
                Column("exception_frames.function"),
            ]
        )
        .set_where(
            [
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("group_id"), Op.IN, group_ids),
                Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=14)),
                Condition(Column("timestamp"), Op.LT, datetime.now()),
                # NOTE: ideally this would follow suspect commit logic
                BooleanCondition(
                    BooleanOp.OR,
                    [
                        BooleanCondition(
                            BooleanOp.AND,
                            [
                                Condition(
                                    Function(
                                        "arrayElement",
                                        (Column("exception_frames.filename"), i),
                                    ),
                                    Op.IN,
                                    sentry_filenames,
                                ),
                                language_parser.generate_function_name_conditions(
                                    function_names, i
                                ),
                            ],
                        )
                        for i in range(-STACKFRAME_COUNT, 0)  # first n frames
                    ],
                ),
                Condition(Function("notHandled", []), Op.EQ, 1),
            ]
        )
        .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
    )

    # filter on the subquery to squash group_ids with the same title and culprit
    # return the group_id with the greatest count of events
    query = (
        Query(subquery)
        .set_select(
            [
                Column("function_name"),
                Function(
                    "arrayElement",
                    (Function("groupArray", [Column("group_id")]), 1),
                    "group_id",
                ),
                Function(
                    "arrayElement",
                    (Function("groupArray", [Column("event_count")]), 1),
                    "event_count",
                ),
            ]
        )
        .set_groupby(
            [
                Column("title"),
                Column("culprit"),
                Column("function_name"),
            ]
        )
        .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
        .set_limit(5)
    )

    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        tenant_ids={"organization_id": projects[0].organization_id},
        query=query,
    )

    try:
        return raw_snql_query(request, referrer=Referrer.GITHUB_PR_COMMENT_BOT.value)["data"]
    except Exception:
        logger.exception(
            "github.open_pr_comment.snuba_query_error", extra={"query": request.to_dict()["query"]}
        )
        return []


@instrumented_task(
    name="sentry.integrations.github.tasks.open_pr_comment_workflow", silo_mode=SiloMode.REGION
)
def open_pr_comment_workflow(pr_id: int) -> None:
    logger.info("github.open_pr_comment.start_workflow")

    # CHECKS
    # check PR exists to get PR key
    try:
        pull_request = PullRequest.objects.get(id=pr_id)
    except PullRequest.DoesNotExist:
        logger.info("github.open_pr_comment.pr_missing")
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_pr"},
        )
        return

    # check org option
    org_id = pull_request.organization_id
    try:
        Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        logger.exception("github.open_pr_comment.org_missing")
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_org"},
        )
        return

    # check PR repo exists to get repo name
    try:
        repo = Repository.objects.get(id=pull_request.repository_id)
    except Repository.DoesNotExist:
        logger.info("github.open_pr_comment.repo_missing", extra={"organization_id": org_id})
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_repo"},
        )
        return

    # check integration exists to hit Github API with client
    integration = integration_service.get_integration(
        integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.info("github.open_pr_comment.integration_missing", extra={"organization_id": org_id})
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_integration"},
        )
        return

    installation = integration.get_installation(organization_id=org_id)
    assert isinstance(installation, CommitContextIntegration)

    client = installation.get_client()

    # CREATING THE COMMENT

    # fetch the files in the PR and determine if it is safe to comment
    pr_files = safe_for_comment(gh_client=client, repository=repo, pull_request=pull_request)

    if len(pr_files) == 0:
        logger.info(
            "github.open_pr_comment.not_safe_for_comment", extra={"file_count": len(pr_files)}
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "unsafe_for_comment"},
        )
        return

    pullrequest_files = get_pr_files(pr_files)

    issue_table_contents = {}
    top_issues_per_file = []

    patch_parsers = PATCH_PARSERS
    # NOTE: if we are testing beta patch parsers, add check here

    file_extensions = set()
    # fetch issues related to the files
    for file in pullrequest_files:
        projects, sentry_filenames = get_projects_and_filenames_from_source_file(
            org_id, repo.id, file.filename
        )
        if not len(projects) or not len(sentry_filenames):
            continue

        file_extension = file.filename.split(".")[-1]
        logger.info(
            "github.open_pr_comment.file_extension",
            extra={
                "organization_id": org_id,
                "repository_id": repo.id,
                "extension": file_extension,
            },
        )

        language_parser = patch_parsers.get(file.filename.split(".")[-1], None)
        if not language_parser:
            logger.info(
                "github.open_pr_comment.missing_parser", extra={"extension": file_extension}
            )
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration="github", key="missing_parser"),
                tags={"extension": file_extension},
            )
            continue

        function_names = language_parser.extract_functions_from_patch(file.patch)

        if file_extension in ["js", "jsx"]:
            logger.info(
                "github.open_pr_comment.javascript",
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["php"]:
            logger.info(
                "github.open_pr_comment.php",
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["rb"]:
            logger.info(
                "github.open_pr_comment.ruby",
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if not len(function_names):
            continue

        top_issues = get_top_5_issues_by_count_for_file(
            list(projects), list(sentry_filenames), list(function_names)
        )
        if not len(top_issues):
            continue

        top_issues_per_file.append(top_issues)
        file_extensions.add(file_extension)

        issue_table_contents[file.filename] = get_issue_table_contents(top_issues)

    if not len(issue_table_contents):
        logger.info("github.open_pr_comment.no_issues")
        # don't leave a comment if no issues for files in PR
        metrics.incr(OPEN_PR_METRICS_BASE.format(integration="github", key="no_issues"))
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
            issue_table = format_issue_table(
                pr_filename, issue_table_content, patch_parsers, toggle=False
            )
            first_table = False
        else:
            # toggle all tables but the first one
            issue_table = format_issue_table(
                pr_filename, issue_table_content, patch_parsers, toggle=True
            )

        issue_tables.append(issue_table)

    comment_body = format_open_pr_comment(issue_tables)

    # list all issues in the comment
    issue_list: list[dict[str, Any]] = list(itertools.chain.from_iterable(top_issues_per_file))
    issue_id_list: list[int] = [issue["group_id"] for issue in issue_list]

    # pick one language from the list of languages in the PR for analytics
    languages = [
        EXTENSION_LANGUAGE_MAP[extension]
        for extension in file_extensions
        if extension in EXTENSION_LANGUAGE_MAP
    ]
    language = languages[0] if len(languages) else "not found"

    try:
        installation.create_or_update_comment(
            repo=repo,
            pr_key=pull_request.key,
            comment_body=comment_body,
            pullrequest_id=pull_request.id,
            issue_list=issue_id_list,
            comment_type=CommentType.OPEN_PR,
            metrics_base=OPEN_PR_METRICS_BASE,
            language=language,
        )
    except ApiError as e:
        if e.json:
            if ISSUE_LOCKED_ERROR_MESSAGE in e.json.get("message", ""):
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
                    tags={"type": "issue_locked_error"},
                )
                return

            elif RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr(
                    OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
                    tags={"type": "rate_limited_error"},
                )
                return

        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "api_error"},
        )
        raise
