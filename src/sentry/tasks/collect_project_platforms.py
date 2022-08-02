from datetime import timedelta

from django.utils import timezone

from sentry.constants import VALID_PLATFORMS
from sentry.models import Group, Project, ProjectPlatform
from sentry.tasks.base import instrumented_task


def paginate_projects_by_id():
    id_cursor = -1
    while True:
        queryset = Project.objects.filter(id__gt=id_cursor).order_by("id")
        page = list(queryset[:1000])
        if not page:
            return
        yield page
        id_cursor = page[-1].id


@instrumented_task(name="sentry.tasks.collect_project_platforms", queue="stats")
def collect_project_platforms(**kwargs):
    now = timezone.now()

    for page_of_projects in paginate_projects_by_id():
        queryset = (
            Group.objects.using_replica()
            .filter(
                last_seen__gte=now - timedelta(days=1),
                project_id__in=page_of_projects,
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

    # remove (likely) unused platform associations
    ProjectPlatform.objects.filter(last_seen__lte=now - timedelta(days=90)).delete()
