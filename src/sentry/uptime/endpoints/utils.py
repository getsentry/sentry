from collections.abc import Callable

from sentry.models.project import Project
from sentry.uptime.models import ProjectUptimeSubscription

MAX_UPTIME_SUBSCRIPTION_IDS = 100
"""
Maximum number of uptime subscription IDs that may be queried at once
"""


def authorize_and_map_project_uptime_subscription_ids(
    project_uptime_subscription_ids: list[str],
    projects: list[Project],
    sub_id_formatter: Callable[[str], str],
) -> tuple[dict[str, int], list[str]]:
    """
    Authorize the project uptime subscription ids and return their corresponding subscription ids.

    We don't store the project uptime subscription id in snuba, so we need to map it to the subscription id.

    Args:
        project_uptime_subscription_ids: List of ProjectUptimeSubscription IDs as strings
        projects: List of Project objects the user has access to
        sub_id_formatter: Function to format subscription IDs (e.g., hex vs string format)

    Returns:
        Tuple of:
        - Mapping from formatted subscription_id to project_uptime_subscription_id
        - List of formatted subscription IDs for use in Snuba queries

    Raises:
        ValueError: If any of the provided IDs are invalid or unauthorized
    """
    project_uptime_subscription_ids_ints = [int(_id) for _id in project_uptime_subscription_ids]
    project_uptime_subscriptions = ProjectUptimeSubscription.objects.filter(
        project_id__in=[project.id for project in projects],
        id__in=project_uptime_subscription_ids_ints,
    ).values_list("id", "uptime_subscription__subscription_id")

    validated_project_uptime_subscription_ids = {
        project_uptime_subscription[0]
        for project_uptime_subscription in project_uptime_subscriptions
        if project_uptime_subscription[0] is not None
    }
    if set(project_uptime_subscription_ids_ints) != validated_project_uptime_subscription_ids:
        raise ValueError("Invalid project uptime subscription ids provided")

    subscription_id_to_project_uptime_subscription_id = {
        sub_id_formatter(project_uptime_subscription[1]): project_uptime_subscription[0]
        for project_uptime_subscription in project_uptime_subscriptions
        if project_uptime_subscription[0] is not None and project_uptime_subscription[1] is not None
    }

    validated_subscription_ids = [
        sub_id_formatter(project_uptime_subscription[1])
        for project_uptime_subscription in project_uptime_subscriptions
        if project_uptime_subscription[1] is not None
    ]

    return subscription_id_to_project_uptime_subscription_id, validated_subscription_ids
