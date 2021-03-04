from datetime import timedelta
from django.conf import settings
from django.db.models import F
from django.utils import timezone

from sentry.models import Organization, OrganizationStatus, User
from sentry.tasks.base import instrumented_task
from sentry.tasks.deletion import delete_organization


@instrumented_task(
    name="sentry.demo.tasks.delete_users_orgs",
)
def delete_users_orgs(**kwargs):
    if not settings.DEMO_MODE:
        return

    # delete everything older than a day
    cutoff_time = timezone.now() - timedelta(days=1)

    # first mark orgs for deletion
    # note this only runs in demo mode (not SaaS) so the underlying tables here are small
    org_list = Organization.objects.filter(
        date_added__lte=cutoff_time, flags=F("flags").bitor(Organization.flags["demo_mode"])
    )
    org_list.update(status=OrganizationStatus.PENDING_DELETION)

    # next delete the users
    User.objects.filter(
        date_joined__lte=cutoff_time, flags=F("flags").bitor(User.flags["demo_mode"])
    ).delete()

    # now finally delete the orgs
    for org in org_list:
        # apply async so if so we continue if one org aborts
        delete_organization.apply_async(kwargs={"object_id": org.id})
