from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from time import time
from typing import Any

from django.utils import timezone as django_timezone

from sentry import analytics
from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.issues import grouptype
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import GroupInboxRemoveAction, remove_group_from_inbox
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.signals import issue_resolved
from sentry.silo.base import SiloMode
from sentry.tasks.auto_ongoing_issues import log_error_if_queue_has_items
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType

ONE_HOUR = 3600


@instrumented_task(
    name="sentry.tasks.schedule_auto_resolution",
    queue="auto_transition_issue_states",
    time_limit=75,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
@log_error_if_queue_has_items
def schedule_auto_resolution():
    options_qs = ProjectOption.objects.filter(
        key__in=["sentry:resolve_age", "sentry:_last_auto_resolve"]
    )
    opts_by_project: dict[int, dict[str, Any]] = defaultdict(dict)
    for opt in options_qs:
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
    name="sentry.tasks.auto_resolve_project_issues",
    queue="auto_transition_issue_states",
    time_limit=75,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
@log_error_if_queue_has_items
def auto_resolve_project_issues(project_id, cutoff=None, chunk_size=1000, **kwargs):
    project = Project.objects.get_from_cache(id=project_id)
    age = project.get_option("sentry:resolve_age", None)
    if not age:
        return

    project.update_option("sentry:_last_auto_resolve", int(time()))

    if cutoff:
        cutoff = datetime.fromtimestamp(cutoff, timezone.utc)
    else:
        cutoff = django_timezone.now() - timedelta(hours=int(age))

    filter_conditions = {
        "project": project,
        "last_seen__lte": cutoff,
        "status": GroupStatus.UNRESOLVED,
    }

    enabled_auto_resolve_types = [
        group_type.type_id
        for group_type in grouptype.registry.all()
        if group_type.enable_auto_resolve
    ]
    filter_conditions["type__in"] = enabled_auto_resolve_types

    queryset = list(Group.objects.filter(**filter_conditions)[:chunk_size])

    might_have_more = len(queryset) == chunk_size

    for group in queryset:
        happened = Group.objects.filter(
            id=group.id,
            status=GroupStatus.UNRESOLVED,
            last_seen__lte=cutoff,
        ).update(
            status=GroupStatus.RESOLVED,
            resolved_at=django_timezone.now(),
            substatus=None,
        )
        remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED)

        if happened:
            Activity.objects.create(
                group=group,
                project=project,
                type=ActivityType.SET_RESOLVED_BY_AGE.value,
                data={"age": age},
            )
            record_group_history(group, GroupHistoryStatus.AUTO_RESOLVED)

            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

            analytics.record(
                "issue.auto_resolved",
                project_id=project.id,
                organization_id=project.organization_id,
                group_id=group.id,
                issue_type=group.issue_type.slug,
                issue_category=group.issue_category.name.lower(),
            )
            # auto-resolve is a kind of resolve and this signal makes
            # sure all things that need to happen after resolve are triggered
            # examples are analytics and webhooks
            issue_resolved.send_robust(
                organization_id=project.organization_id,
                user=None,
                group=group,
                project=project,
                resolution_type="autoresolve",
                sender="auto_resolve_issues",
            )

    if might_have_more:
        auto_resolve_project_issues.delay(
            project_id=project_id, cutoff=int(cutoff.strftime("%s")), chunk_size=chunk_size
        )
