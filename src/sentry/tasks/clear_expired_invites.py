from __future__ import absolute_import, print_function

from datetime import timedelta

from django.utils import timezone

from sentry.models import OrganizationMember
from sentry.tasks.base import instrumented_task


@instrumented_task(name='sentry.tasks.clear_expired_invites')
def clear_expired_invites():
    """
    Delete organization member invitations that have not been claimed
    and have been open for more than 90 days.
    """
    ninety_days = timezone.now() - timedelta(days=90)
    query = OrganizationMember.objects.filter(
        token_expires_at__lt=ninety_days,
        user_id__exact=None,
    ).exclude(email__exact=None)

    query.delete()
