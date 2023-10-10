from datetime import timedelta

from django.utils import timezone

from sentry.constants import VALID_PLATFORMS
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.projectplatform import ProjectPlatform
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task


def paginate_project_ids(paginate):
    id_cursor = -1
    while True:
        queryset = (
            Project.objects.filter(id__gt=id_cursor).order_by("id").values_list("id", flat=True)
        )
        page = list(queryset[:paginate])
        if not page:
            return
        yield page
        id_cursor = page[-1]


@instrumented_task(
    name="sentry.tasks.collect_project_platforms",
    queue="stats",
    silo_mode=SiloMode.REGION,
)
def collect_project_platforms(paginate=1000, **kwargs):
    now = timezone.now()

    for page_of_project_ids in paginate_project_ids(paginate):
        queryset = (
            Group.objects.using_replica()
            .filter(
                last_seen__gte=now - timedelta(days=1),
                project_id__in=page_of_project_ids,
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
