import logging
from datetime import UTC, datetime, timedelta

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


def get_issues_related_to_exception_types(
    *,
    organization_id: int,
    provider: str,
    external_id: str,
    exception_types: list[str],
    max_num_issues_per_exception_type: int = MAX_NUM_ISSUES_DEFAULT,
    num_days_ago: int = NUM_DAYS_AGO,
    run_id: int | None = None,
) -> dict[str, list[int]]:
    """
    Fetches issue ids with the given exception types.

    Args:
        organization_id: The organization id.
        provider: The provider of the repository.
        external_id: The external id of the repository.
        exception_types: The exception types to fetch issues for.
        max_num_issues_per_exception_type: The maximum number of issues to fetch per exception type.
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
        return {}

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
        return {}

    # Get project ids from repo_project_path_configs
    project_ids = repo_project_path_configs.values_list("project_id", flat=True)

    result = {}
    for exception_type in exception_types:
        # Fetch issues without filtering on 'data'
        issues = Group.objects.filter(
            project_id__in=project_ids,
            last_seen__gte=datetime.now(tz=UTC) - timedelta(days=num_days_ago),
        ).order_by("last_seen")[:max_num_issues_per_exception_type]

        # Filter issues in Python based on 'metadata' field
        filtered_issues = [
            issue.id
            for issue in issues
            if issue.data.get("metadata", {}).get("type") == exception_type
        ]
        result[exception_type] = filtered_issues

    return result
