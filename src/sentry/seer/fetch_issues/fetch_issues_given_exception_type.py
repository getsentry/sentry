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


def get_issues_related_to_exception_type(
    *,
    organization_id: int,
    provider: str,
    external_id: str,
    exception_type: str,
    max_num_issues: int = MAX_NUM_ISSUES_DEFAULT,
    num_days_ago: int = NUM_DAYS_AGO,
    run_id: int | None = None,
) -> list[int]:
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
        return []

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
        return []

    project_ids = repo_project_path_configs.values_list("project_id", flat=True)
    date_threshold = datetime.now(tz=UTC) - timedelta(days=num_days_ago)

    # Fetch issues where the exception type is the given exception type
    # Using raw SQL since data is GzippedDictField which can't be filtered with Django ORM
    query = """
        SELECT * FROM sentry_groupedmessage
        WHERE project_id IN %s
        AND last_seen >= %s
        AND (data::json -> 'metadata' ->> 'type') = %s
        ORDER BY last_seen
        LIMIT %s
    """
    issues = Group.objects.raw(
        query, [tuple(project_ids), date_threshold, exception_type, max_num_issues]
    )

    # Extract IDs from the returned Group objects
    return [issue.id for issue in issues]
