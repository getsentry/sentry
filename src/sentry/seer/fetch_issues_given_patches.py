import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal, TypedDict

from django.db.models import Value
from django.db.models.functions import StrIndex
from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Entity, Function, Op, Query
from snuba_sdk import Request as SnubaRequest

from sentry import eventstore
from sentry.api.serializers import EventSerializer, serialize
from sentry.api.serializers.models.event import EventSerializerResponse
from sentry.integrations.github.tasks.language_parsers import (
    PATCH_PARSERS,
    LanguageParser,
    SimpleLanguageParser,
)
from sentry.integrations.github.tasks.open_pr_comment import (
    MAX_RECENT_ISSUES,
    OPEN_PR_MAX_FILES_CHANGED,
    OPEN_PR_MAX_LINES_CHANGED,
)
from sentry.integrations.github.tasks.utils import PullRequestFile
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


MAX_NUM_ISSUES_PER_FILE_DEFAULT = 5
"""
The maximum number of related issues to return for one file.
"""

NUM_DAYS_AGO = 14
"""
The number of previous days from now to find issues and events.
This number is global so that fetching issues and events is consistent.
"""

STACKFRAME_COUNT = 20
"""
The number of stack frames to check for function name and file name matches.
"""


class PrFile(TypedDict):
    filename: str
    patch: str
    status: Literal[
        "added",
        "removed",
        "modified",
        "renamed",
        "copied",
        "changed",
        "unchanged",
    ]
    changes: int


def safe_for_fetching_issues(pr_files: list[PrFile]) -> list[PrFile]:
    changed_file_count = 0
    changed_lines_count = 0
    filtered_pr_files = []
    for file in pr_files:
        file_extension = file["filename"].split(".")[-1]
        if file["status"] != "modified" or file_extension not in PATCH_PARSERS:
            continue

        changed_file_count += 1
        changed_lines_count += file["changes"]
        filtered_pr_files.append(file)

        if changed_file_count > OPEN_PR_MAX_FILES_CHANGED:
            return []
        if changed_lines_count > OPEN_PR_MAX_LINES_CHANGED:
            return []

    return filtered_pr_files


def _get_issues_for_file(
    projects: list[Project],
    sentry_filenames: list[str],
    function_names: list[str],
    event_timestamp_start: datetime,
    event_timestamp_end: datetime,
    max_num_issues_per_file: int = MAX_NUM_ISSUES_PER_FILE_DEFAULT,
) -> list[dict[str, Any]]:
    """
    Fetch issues with their latest event if its stacktrace frames match the function names
    and file names.
    """
    if not projects:
        return []

    patch_parsers: dict[str, LanguageParser | SimpleLanguageParser] = PATCH_PARSERS

    # Gets the appropriate parser for formatting the snuba query given the file extension.
    # The extension is never replaced in reverse codemapping.
    file_extension = sentry_filenames[0].split(".")[-1]
    if file_extension not in patch_parsers:
        return []
    language_parser = patch_parsers[file_extension]

    # Fetch an initial, candidate set of groups.
    group_ids: list[int] = list(
        Group.objects.filter(
            first_seen__gte=datetime.now(UTC) - timedelta(days=90),
            last_seen__gte=event_timestamp_start,
            status__in=[GroupStatus.UNRESOLVED, GroupStatus.RESOLVED],
            project__in=projects,
        )
        .order_by("-times_seen")
        .values_list("id", flat=True)
    )[:MAX_RECENT_ISSUES]
    project_ids = [project.id for project in projects]
    multi_if = language_parser.generate_multi_if(function_names)

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
                Function("multiIf", multi_if, "function_name"),
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
                                language_parser.generate_function_name_conditions(
                                    function_names, stackframe_idx
                                ),
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
    return raw_snql_query(request, referrer=Referrer.SEER_RPC.value)["data"]


def _add_event_details(
    projects: list[Project],
    issues_result_set: list[dict[str, Any]],
    event_timestamp_start: datetime | None,
    event_timestamp_end: datetime | None,
) -> list[dict[str, Any]]:
    """
    Bulk-fetch the events corresponding to the issues, and bulk-serialize them.
    """
    if not issues_result_set:
        return []
    event_filter = eventstore.Filter(
        start=event_timestamp_start,
        end=event_timestamp_end,
        event_ids=[group_dict["event_id"] for group_dict in issues_result_set],
        project_ids=[project.id for project in projects],
    )
    events = eventstore.backend.get_events(
        filter=event_filter,
        referrer=Referrer.SEER_RPC.value,
        tenant_ids={"organization_id": projects[0].organization_id},
    )
    serialized_events: list[EventSerializerResponse] = serialize(
        events, serializer=EventSerializer()
    )
    group_id_to_group_dict = {
        group_dict["group_id"]: group_dict for group_dict in issues_result_set
    }
    return [
        {  # Structured like seer.automation.models.IssueDetails
            "id": int(event_dict["groupID"]),
            "title": event_dict["title"],
            "events": [event_dict],
            "function_name": group_id_to_group_dict[int(event_dict["groupID"])]["function_name"],
        }
        for event_dict in serialized_events
        if event_dict["groupID"] is not None
    ]


def get_issues_with_event_details_for_file(
    projects: list[Project],
    sentry_filenames: list[str],
    function_names: list[str],
    max_num_issues_per_file: int = MAX_NUM_ISSUES_PER_FILE_DEFAULT,
) -> list[dict[str, Any]]:
    event_timestamp_start = datetime.now(UTC) - timedelta(days=NUM_DAYS_AGO)
    event_timestamp_end = datetime.now(UTC)
    issues_result_set = _get_issues_for_file(
        projects,
        sentry_filenames,
        function_names,
        event_timestamp_start,
        event_timestamp_end,
        max_num_issues_per_file=max_num_issues_per_file,
    )
    issues = _add_event_details(
        projects, issues_result_set, event_timestamp_start, event_timestamp_end
    )
    return issues


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


def get_issues_related_to_file_patches(
    *,
    organization_id: int,
    provider: str,
    external_id: str,
    pr_files: list[PrFile],
    max_num_issues_per_file: int = MAX_NUM_ISSUES_PER_FILE_DEFAULT,
) -> dict[str, list[dict[str, Any]]]:
    """
    Get the top issues related to each file by looking at matches between functions in the patch
    and functions in the issue's event's stacktrace.

    Each issue includes its latest serialized event.
    """

    try:
        repo = Repository.objects.get(
            organization_id=organization_id, provider=provider, external_id=external_id
        )
    except Repository.DoesNotExist:
        logger.exception(
            "Repo doesn't exist",
            extra={
                "organization_id": organization_id,
                "provider": provider,
                "external_id": external_id,
            },
        )
        return {}

    repo_id = repo.id

    pr_files = safe_for_fetching_issues(pr_files)
    pullrequest_files = [
        PullRequestFile(filename=file["filename"], patch=file["patch"]) for file in pr_files
    ]

    filename_to_issues = {}
    patch_parsers: dict[str, LanguageParser | SimpleLanguageParser] = PATCH_PARSERS

    for file in pullrequest_files:
        projects, sentry_filenames = _get_projects_and_filenames_from_source_file(
            organization_id, repo_id, file.filename
        )
        if not projects:
            logger.error("No projects", extra={"file": file.filename})
            continue

        file_extension = file.filename.split(".")[-1]
        if file_extension not in patch_parsers:
            logger.error("No language parser", extra={"file": file.filename})
            continue
        language_parser = patch_parsers[file_extension]

        function_names = language_parser.extract_functions_from_patch(file.patch)
        if not function_names:
            logger.error("No function names", extra={"file": file.filename})
            continue

        issues = get_issues_with_event_details_for_file(
            list(projects),
            list(sentry_filenames),
            list(function_names),
            max_num_issues_per_file=max_num_issues_per_file,
        )
        filename_to_issues[file.filename] = issues

    return filename_to_issues
