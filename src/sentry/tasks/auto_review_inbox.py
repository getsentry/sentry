from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupInbox, Organization, Project, OrganizationStatus
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.schedule_auto_review_inbox", time_limit=65, soft_time_limit=60
)
def schedule_auto_review_inbox():
    for organization in Organization.objects.filter(status=OrganizationStatus.ACTIVE).iterator():
        for project in Project.objects.filter(organization=organization).values("id"):
            auto_review_inbox.delay(project["id"])


@instrumented_task(name="sentry.tasks.auto_review_inbox", time_limit=65, soft_time_limit=60)
def auto_review_inbox(project_id, chunk_size=1000):
    cutoff = timezone.now() - timedelta(days=7)

    queryset = list(
        GroupInbox.objects.filter(date_added__lte=cutoff, project=project_id).values_list(
            "id", flat=True
        )[:chunk_size]
    )

    might_have_more = len(queryset) == chunk_size

    GroupInbox.objects.filter(id__in=queryset).delete()

    if might_have_more:
        auto_review_inbox.delay(project_id, chunk_size)
