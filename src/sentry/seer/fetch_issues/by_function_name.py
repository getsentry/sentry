import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TypedDict

from django.db.models import Value
from django.db.models.functions import StrIndex
from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Entity, Function, Op, Query
from snuba_sdk import Request as SnubaRequest

from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.seer.fetch_issues import utils
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


MAX_NUM_ISSUES_PER_FILE_DEFAULT = 5
"""
The maximum number of related issues to return for one file.
"""

NUM_DAYS_AGO = 28
"""
The number of previous days from now to find issues.
"""

STACKFRAME_COUNT = 20
"""
The number of stack frames to check for function name and file name matches.
"""

OPEN_PR_MAX_RECENT_ISSUES = 5000


class IssueFromSnuba(TypedDict):
    group_id: int
    event_id: str
    title: str


def _simple_function_name_conditions(function_names: list[str], stack_frame_idx: int) -> Condition:
    return Condition(
        Function(
            "arrayElement",
            (Column("exception_frames.function"), stack_frame_idx),
        ),
        Op.IN,
        function_names,
    )


def _get_issues_for_file(
    projects: list[Project],
    sentry_filenames: list[str],
    function_names: list[str],
    event_timestamp_start: datetime,
    event_timestamp_end: datetime,
    max_num_issues_per_file: int = MAX_NUM_ISSUES_PER_FILE_DEFAULT,
    run_id: int | None = None,
) -> list[IssueFromSnuba]:
    """
    Fetch issues with their latest event if its stacktrace frames match the function names
    and file names.
    """
    if not projects:
        return []

    # Fetch an initial, candidate set of groups.
    group_ids: list[int] = list(
        Group.objects.filter(
            first_seen__gte=datetime.now(UTC) - timedelta(weeks=26),
            last_seen__gte=event_timestamp_start,
            status__in=[GroupStatus.UNRESOLVED, GroupStatus.RESOLVED],
            project__in=projects,
        )
        .order_by("-times_seen")
        .values_list("id", flat=True)
    )[:OPEN_PR_MAX_RECENT_ISSUES]
    project_ids = [project.id for project in projects]

    # Fetch the latest event for each group, along with some other event data we'll need for
    # filtering by function names and file names.
    subquery = (
        Query(Entity("events"))
        .set_select(
            [
                Column("group_id"),
                Function(
                    "argMax",
                    [Column("event_id"), Column("timestamp")],
                    "event_id",
                ),
                Function(
                    "argMax",
                    [Column("title"), Column("timestamp")],
                    "title",
                ),
                Function(
                    "argMax",
                    [Column("exception_frames.filename"), Column("timestamp")],
                    "exception_frames.filename",
                ),
                Function(
                    "argMax",
                    [Column("exception_frames.function"), Column("timestamp")],
                    "exception_frames.function",
                ),
            ]
        )
        .set_groupby(
            [
                Column("group_id"),
            ]
        )
        .set_where(
            [
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("group_id"), Op.IN, group_ids),
                Condition(Column("timestamp"), Op.GTE, event_timestamp_start),
                Condition(Column("timestamp"), Op.LT, event_timestamp_end),
            ]
        )
    )

    # Filter out groups whose event's stacktrace doesn't match the function names and file names.
    query = (
        Query(subquery)
        .set_select(
            [
                Column("group_id"),
                Column("event_id"),
                Column("title"),
            ]
        )
        .set_where(
            [
                BooleanCondition(
                    BooleanOp.OR,
                    [
                        BooleanCondition(
                            BooleanOp.AND,
                            [
                                Condition(
                                    Function(
                                        "arrayElement",
                                        (Column("exception_frames.filename"), stackframe_idx),
                                    ),
                                    Op.IN,
                                    sentry_filenames,
                                ),
                                _simple_function_name_conditions(function_names, stackframe_idx),
                            ],
                        )
                        for stackframe_idx in range(-STACKFRAME_COUNT, 0)  # first n frames
                    ],
                ),
            ]
        )
        .set_limit(max_num_issues_per_file)
    )
    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        tenant_ids={"organization_id": projects[0].organization_id},
        query=query,
    )
    try:
        return raw_snql_query(request, referrer=Referrer.SEER_RPC.value)["data"]
    except Exception:
        logger.exception(
            "Seer fetch issues given patches Snuba query error",
            extra={"query": request.to_dict()["query"], "run_id": run_id},
        )
        return []


def _left_truncated_paths(filename: str, max_num_paths: int = 2) -> list[str]:
    """
    Example::

        paths = _left_truncated_paths("src/seer/automation/agent/client.py", 2)
        assert paths == [
            "seer/automation/agent/client.py",
            "automation/agent/client.py",
        ]
    """
    path = Path(filename)
    parts = list(path.parts)
    num_dirs = len(parts) - 1  # -1 for the filename
    num_paths = min(max_num_paths, num_dirs)

    result = []
    for _ in range(num_paths):
        parts.pop(0)
        result.append(str(Path(*parts)))
    return result


def _get_projects_and_filenames_from_source_file(
    org_id: int, repo_id: int, pr_filename: str, max_num_left_truncated_paths: int = 2
) -> tuple[set[Project], set[str]]:
    # Fetch the code mappings in which the source_root is a substring at the start of pr_filename
    code_mappings = (
        RepositoryProjectPathConfig.objects.filter(
            organization_id=org_id,
            repository_id=repo_id,
        )
        .annotate(substring_match=StrIndex(Value(pr_filename), "source_root"))
        .filter(substring_match=1)
    )
    projects_set = {code_mapping.project for code_mapping in code_mappings}
    sentry_filenames = {
        pr_filename.replace(code_mapping.source_root, code_mapping.stack_root, 1)
        for code_mapping in code_mappings
    }
    # The code-mapped filenames alone aren't enough. They don't work for the seer app, for example.
    # We can tolerate potential false positives if downstream uses of this data filter
    # out irrelevant issues.
    sentry_filenames.add(pr_filename)
    sentry_filenames.update(_left_truncated_paths(pr_filename, max_num_left_truncated_paths))
    return projects_set, sentry_filenames


def _fetch_issues_from_repo_projects(
    repo_projects: utils.RepoProjects,
    filename: str,
    function_name: str,
    max_num_issues_per_file: int = MAX_NUM_ISSUES_PER_FILE_DEFAULT,
    run_id: int | None = None,
) -> list[Group]:
    event_timestamp_start = datetime.now(UTC) - timedelta(days=NUM_DAYS_AGO)
    event_timestamp_end = datetime.now(UTC)

    file_projects, sentry_filenames = _get_projects_and_filenames_from_source_file(
        repo_projects.organization_id, repo_projects.repo.id, filename
    )
    file_projects_list = list(file_projects)
    if not file_projects:
        logger.warning(
            "No projects found for file. Using all projects.",
            extra={"file": filename, "function_name": function_name, "run_id": run_id},
        )
        file_projects_list = repo_projects.projects

    issues = _get_issues_for_file(
        file_projects_list,
        list(sentry_filenames),
        [function_name],
        event_timestamp_start,
        event_timestamp_end,
        max_num_issues_per_file=max_num_issues_per_file,
        run_id=run_id,
    )
    group_ids = [issue["group_id"] for issue in issues]
    return list(Group.objects.filter(id__in=group_ids).order_by("-last_seen"))


@utils.handle_fetch_issues_exceptions
def fetch_issues(
    organization_id: int,
    provider: str,
    external_id: str,
    filename: str,
    function_name: str,
    max_num_issues_per_file: int = MAX_NUM_ISSUES_PER_FILE_DEFAULT,
    run_id: int | None = None,
) -> utils.SeerResponse | utils.SeerResponseError:
    """
    Fetch issues containing an event w/ a stacktrace frame that matches the `filename` and `function_name`.
    """
    repo_projects = utils.get_repo_and_projects(
        organization_id, provider, external_id, run_id=run_id
    )
    groups = _fetch_issues_from_repo_projects(
        repo_projects,
        filename,
        function_name,
        max_num_issues_per_file=max_num_issues_per_file,
        run_id=run_id,
    )
    return utils.bulk_serialize_for_seer(groups)
