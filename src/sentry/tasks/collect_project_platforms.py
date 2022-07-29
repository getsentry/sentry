from datetime import timedelta

from django.db.models import Max, Min
from django.utils import timezone

from sentry.constants import VALID_PLATFORMS
from sentry.models import Group, Project, ProjectPlatform
from sentry.tasks.base import instrumented_task


def _collect_project_platforms(min_project_id, max_project_id, now, step):
    while min_project_id <= max_project_id:
        queryset = (
            Group.objects.using_replica()
            .filter(
                last_seen__gte=now - timedelta(days=1),
                project__gte=min_project_id,
                project__lt=min_project_id + step,
                platform__isnull=False,
            )
            .values_list("platform", "project_id")
            .distinct()
        )

        for platform, project_id in queryset:
            platform = platform.lower()
            if platform not in VALID_PLATFORMS:
                continue
            ProjectPlatform.objects.create_or_update(
                project_id=project_id, platform=platform, values={"last_seen": now}
            )
        min_project_id += step


@instrumented_task(name="sentry.tasks.collect_project_platforms", queue="stats")
def collect_project_platforms(**kwargs):
    now = timezone.now()

    pre_snowflake_max_value = 2147483647

    min_project_id = 0
    max_project_id_before_snowflake = Project.objects.filter(
        id__lt=pre_snowflake_max_value
    ).aggregate(x=Max("id"))["x"]
    step = 1000

    _collect_project_platforms(min_project_id, max_project_id_before_snowflake, now, step)

    min_project_id_after_snowflake = Project.objects.filter(
        id__gt=pre_snowflake_max_value
    ).aggregate(x=Min("id"))["x"]
    max_project_id_after_snowflake = Project.objects.filter(
        id__gt=pre_snowflake_max_value
    ).aggregate(x=Max("id"))["x"]
    step = max((max_project_id_after_snowflake - min_project_id_after_snowflake) / 1000, 1)

    _collect_project_platforms(
        min_project_id_after_snowflake, max_project_id_after_snowflake, now, step
    )

    # remove (likely) unused platform associations
    ProjectPlatform.objects.filter(last_seen__lte=now - timedelta(days=90)).delete()
