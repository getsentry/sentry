import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from sentry.models import Organization, OrganizationStatus, User
from sentry.tasks.base import instrumented_task
from sentry.tasks.deletion import delete_organization

from .demo_org_manager import create_demo_org
from .models import DemoOrganization, DemoOrgStatus

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.demo.tasks.delete_users_orgs",
)
def delete_users_orgs(**kwargs):
    if not settings.DEMO_MODE:
        return

    logger.info("delete_users_orgs.start")
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
        logger.info("delete_initializing_orgs.delete", extra={"organization_slug": org.slug})
        delete_organization.apply_async(kwargs={"object_id": org.id})


@instrumented_task(
    name="sentry.demo.tasks.delete_initializing_orgs",
)
def delete_initializing_orgs(**kwargs):
    """
    Deletes orgs that are still in the initializing state.
    This happens if Sentry is killed while an organization is being created.
    """
    if not settings.DEMO_MODE:
        return

    logger.info("delete_initializing_orgs.start")
    # delete everything older than MAX_INITIALIZATION_TIME
    max_init_time = settings.DEMO_DATA_GEN_PARAMS["MAX_INITIALIZATION_TIME"]
    cutoff_time = timezone.now() - timedelta(minutes=max_init_time)

    # note this only runs in demo mode (not SaaS) so the underlying tables here are small
    org_list = Organization.objects.filter(
        demoorganization__date_added__lte=cutoff_time,
        demoorganization__status=DemoOrgStatus.INITIALIZING,
    )

    # first mark orgs for deletion
    org_list.update(status=OrganizationStatus.PENDING_DELETION)

    # now finally delete the orgs
    for org in org_list:
        # apply async so if so we continue if one org aborts
        logger.info("delete_initializing_orgs.delete", extra={"organization_slug": org.slug})
        delete_organization.apply_async(kwargs={"object_id": org.id})

    # build up the org buffer at the end to replace the orgs being removed
    build_up_org_buffer()


@instrumented_task(
    name="sentry.demo.tasks.build_up_org_buffer",
)
def build_up_org_buffer():
    if not settings.DEMO_MODE:
        return

    logger.info("build_up_org_buffer.start")
    ORG_BUFFER_SIZE = settings.DEMO_DATA_GEN_PARAMS["ORG_BUFFER_SIZE"]

    # find how many orgs we have waiting assignment or being initialized
    num_orgs = DemoOrganization.objects.filter(
        status__in=[DemoOrgStatus.PENDING, DemoOrgStatus.INITIALIZING]
    ).count()
    num_to_populate = ORG_BUFFER_SIZE - num_orgs
    logger.info("build_up_org_buffer.check", extra={"num_to_populate": num_to_populate})

    # synchronnously build up our org buffer if under sized
    if num_to_populate > 0:
        create_demo_org()
        build_up_org_buffer.apply_async()
