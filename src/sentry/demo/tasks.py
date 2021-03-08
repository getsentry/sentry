from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.template.defaultfilters import slugify

from sentry import roles
from sentry.models import (
    User,
    Organization,
    OrganizationStatus,
    OrganizationMember,
    Project,
    ProjectKey,
)
from sentry.tasks.base import instrumented_task
from sentry.tasks.deletion import delete_organization

from .data_population import populate_python_project, populate_react_project
from .utils import generate_random_name
from .models import DemoOrgStatus, DemoOrganization


@instrumented_task(
    name="sentry.demo.tasks.delete_users_orgs",
)
def delete_users_orgs(**kwargs):
    if not settings.DEMO_MODE:
        return

    # delete everything older than a day
    cutoff_time = timezone.now() - timedelta(seconds=30)

    # note this only runs in demo mode (not SaaS) so the underlying tables here are small
    org_list = Organization.objects.filter(
        demoorganization__isnull=False,
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


@transaction.atomic
def create_demo_org() -> None:
    if not settings.DEMO_MODE:
        return

    # TODO: add way to ensure we generate unique petnames
    name = generate_random_name()

    slug = slugify(name)

    org = DemoOrganization.create_org(name=name, slug=slug)

    owner = User.objects.get(email=settings.DEMO_ORG_OWNER_EMAIL)
    OrganizationMember.objects.create(organization=org, user=owner, role=roles.get_top_dog().id)

    team = org.team_set.create(name=org.name)
    python_project = Project.objects.create(name="Python", organization=org, platform="python")
    python_project.add_team(team)

    react_project = Project.objects.create(
        name="React", organization=org, platform="javascript-react"
    )
    react_project.add_team(team)

    populate_python_project(python_project)
    populate_react_project(react_project)

    # delete all DSNs for the org so people don't send events
    ProjectKey.objects.filter(project__organization=org).delete()


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
