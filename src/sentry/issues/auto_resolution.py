from datetime import datetime

from django.db.models import QuerySet

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType


def recent_unresolved_activities(project_id: int, cutoff: datetime) -> QuerySet[Activity]:
    """Reopenings that grant another project auto-resolution interval."""
    # Scope by project/time to use the existing composite indexes. Exclude NULL
    # group IDs so callers can safely use this as a NOT IN subquery.
    return Activity.objects.filter(
        project_id=project_id,
        datetime__gt=cutoff,
        type=ActivityType.SET_UNRESOLVED.value,
        group_id__isnull=False,
    )
