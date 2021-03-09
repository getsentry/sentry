from datetime import timedelta
from django.conf import settings
from django.utils import timezone

from sentry.models import (
    User,
    Organization,
    OrganizationStatus,
)
from sentry.tasks.base import instrumented_task
from sentry.tasks.deletion import delete_organization

from .models import DemoOrgStatus, DemoOrganization
from .demo_org_manager import create_demo_org


@instrumented_task(
    name="sentry.demo.tasks.delete_users_orgs",
)
def delete_users_orgs(**kwargs):
    if not settings.DEMO_MODE:
        return

    # delete everything older than a day
    cutoff_time = timezone.now() - timedelta(days=1)

    # note this only runs in demo mode (not SaaS) so the underlying tables here are small
    org_list = Organization.objects.filter(
        demoorganization__date_assigned__lte=cutoff_time,
        demoorganization__status=DemoOrgStatus.ACTIVE,
        status__in=(
            OrganizationStatus.ACTIVE,
            OrganizationStatus.PENDING_DELETION,
        ),
    )

    # first mark orgs for deletion
    org_list.update(status=OrganizationStatus.PENDING_DELETION)

    # next delete the users
    User.objects.filter(demouser__isnull=False, demouser__date_assigned__lte=cutoff_time).delete()

    # now finally delete the orgs
    for org in org_list:
        # apply async so if so we continue if one org aborts
        delete_organization.apply_async(kwargs={"object_id": org.id})


ORG_BUFFER_SIZE = 3


@instrumented_task(
    name="sentry.demo.tasks.build_up_org_buffer",
)
def build_up_org_buffer():
    if not settings.DEMO_MODE:
        return

    # find how many orgs we have waiting assignment
    num_orgs = DemoOrganization.objects.filter(status=DemoOrgStatus.PENDING).count()
    num_to_populate = ORG_BUFFER_SIZE - num_orgs

    # synchronnously build up our org buffer if under sized
    if num_to_populate > 0:
        create_demo_org()
        build_up_org_buffer.apply_async()


# on initialization, start building up our org buffer
if settings.DEMO_MODE:
    build_up_org_buffer.apply_async()
