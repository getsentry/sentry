from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupInbox
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.auto_review_inbox", time_limit=65, soft_time_limit=60)
def auto_review_inbox():
    cutoff = timezone.now() - timedelta(days=7)
    group_list = list(
        GroupInbox.objects.filter(date_added__lte=cutoff).values_list("group", flat=True)
    )

    GroupInbox.objects.filter(group__in=group_list).delete()
