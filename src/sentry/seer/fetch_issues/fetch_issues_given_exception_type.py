import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from django.db.models.expressions import RawSQL

from sentry.api.serializers import EventSerializer, serialize
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.group import Group
from sentry.models.repository import Repository

MAX_NUM_ISSUES_DEFAULT = 5
"""
The maximum number of potentially related issues to return.
"""

NUM_DAYS_AGO = 90
"""
The number of previous days from now to find issues and events.
This number is global so that fetching issues and events is consistent.
"""

logger = logging.getLogger(__name__)


def get_latest_issue_event(group_id: int) -> dict[str, Any]:
    """
    Get the latest event for a group.
    """
    group = Group.objects.filter(id=group_id).first()
    if not group:
        logger.warning(
            "Group not found",
            extra={"group_id": group_id},
        )
        return {}

    event = group.get_latest_event()
    if not event:
        logger.warning(
            "No event found",
            extra={"group_id": group_id},
        )
        return {}

    serialized_event = serialize(event, user=None, serializer=EventSerializer())
    return {  # Structured like seer.automation.models.IssueDetails
        "id": int(serialized_event["groupID"]),
        "title": serialized_event["title"],
        "events": [serialized_event],
    }


def get_issues_related_to_exception_type(
    *,
    organization_id: int,
    provider: str,
    external_id: str,
    exception_type: str,
    max_num_issues: int = MAX_NUM_ISSUES_DEFAULT,
    num_days_ago: int = NUM_DAYS_AGO,
    run_id: int | None = None,
) -> dict[str, Any]:
    """
    Fetches issue ids with the given exception types.

    Args:
        organization_id: The organization id.
        provider: The provider of the repository.
        external_id: The external id of the repository.
        exception_type: The exception type to fetch issues for.
        max_num_issues: The maximum number of issues to fetch.
        num_days_ago: The number of days ago to fetch issues for.
        run_id: The run id.

    Returns:
        A dictionary of exception types and their corresponding issue ids.
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
                "run_id": run_id,
            },
        )
        return {"error": "Repo does not exist"}

    repo_id = repo.id

    try:
        repo_project_path_configs = RepositoryProjectPathConfig.objects.filter(
            organization_id=organization_id,
            repository_id=repo_id,
        )
        if repo_project_path_configs.count() == 0:
            raise RepositoryProjectPathConfig.DoesNotExist
    except RepositoryProjectPathConfig.DoesNotExist:
        logger.exception(
            "Repo project path config doesn't exist",
            extra={
                "organization_id": organization_id,
                "provider": provider,
                "external_id": external_id,
            },
        )
        return {"error": "Repo project path config does not exist"}

    project_ids = repo_project_path_configs.values_list("project_id", flat=True)
    date_threshold = datetime.now(tz=UTC) - timedelta(days=num_days_ago)

    # Fetch issues where the exception type is the given exception type
    # Using a bit ofraw SQL since data is GzippedDictField which can't be filtered with Django ORM
    query_set = (
        Group.objects.annotate(metadata_type=RawSQL("(data::json -> 'metadata' ->> 'type')", []))
        .filter(
            metadata_type=exception_type,
            project_id__in=project_ids,
            last_seen__gte=date_threshold,
        )
        .order_by("last_seen")[:max_num_issues]
    )
    return {"issues": [issue.id for issue in query_set]}
