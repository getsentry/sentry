from collections import defaultdict
from datetime import datetime, timedelta
from time import time

from django.utils import timezone

from sentry.models import (
    Activity,
    Group,
    GroupInboxRemoveAction,
    GroupStatus,
    Project,
    ProjectOption,
    remove_group_from_inbox,
)
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations import kick_off_status_syncs

ONE_HOUR = 3600


@instrumented_task(name="sentry.tasks.schedule_auto_resolution", time_limit=75, soft_time_limit=60)
def schedule_auto_resolution():
    options = ProjectOption.objects.filter(
        key__in=["sentry:resolve_age", "sentry:_last_auto_resolve"]
    )
    opts_by_project = defaultdict(dict)
    for opt in options:
        opts_by_project[opt.project_id][opt.key] = opt.value

    cutoff = time() - ONE_HOUR
    for project_id, options in opts_by_project.items():
        if not options.get("sentry:resolve_age"):
            # kill the option to avoid it coming up in the future
            ProjectOption.objects.filter(
                key__in=["sentry:_last_auto_resolve", "sentry:resolve_age"], project=project_id
            ).delete()
            continue

        if int(options.get("sentry:_last_auto_resolve", 0)) > cutoff:
            continue

        auto_resolve_project_issues.delay(project_id=project_id, expires=ONE_HOUR)


@instrumented_task(
    name="sentry.tasks.auto_resolve_project_issues", time_limit=75, soft_time_limit=60
)
def auto_resolve_project_issues(project_id, cutoff=None, chunk_size=1000, **kwargs):
    project = Project.objects.get_from_cache(id=project_id)

    age = project.get_option("sentry:resolve_age", None)
    if not age:
        return

    project.update_option("sentry:_last_auto_resolve", int(time()))

    if cutoff:
        cutoff = datetime.utcfromtimestamp(cutoff).replace(tzinfo=timezone.utc)
    else:
        cutoff = timezone.now() - timedelta(hours=int(age))

    queryset = list(
        Group.objects.filter(project=project, last_seen__lte=cutoff, status=GroupStatus.UNRESOLVED)[
            :chunk_size
        ]
    )

    might_have_more = len(queryset) == chunk_size

    for group in queryset:
        happened = Group.objects.filter(id=group.id, status=GroupStatus.UNRESOLVED).update(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now()
        )
        remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED)

        if happened:
            Activity.objects.create(
                group=group, project=project, type=Activity.SET_RESOLVED_BY_AGE, data={"age": age}
            )

            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

    if might_have_more:
        auto_resolve_project_issues.delay(
            project_id=project_id, cutoff=int(cutoff.strftime("%s")), chunk_size=chunk_size
        )
