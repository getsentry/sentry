import logging

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.template.defaultfilters import slugify
from typing import Tuple

from sentry import roles
from sentry.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    Project,
    ProjectKey,
    Team,
)
from sentry.tasks.deletion import delete_organization
from sentry.utils.email import create_fake_email

from .data_population import (
    handle_react_python_scenario,
)
from .utils import generate_random_name
from .models import DemoUser, DemoOrganization, DemoOrgStatus

logger = logging.getLogger(__name__)


def create_demo_org(quick=False) -> Organization:
    # wrap the main org setup in transaction
    with transaction.atomic():
        name = generate_random_name()

        slug = slugify(name)

        demo_org = DemoOrganization.create_org(name=name, slug=slug)
        org = demo_org.organization

        logger.info("create_demo_org.created_org", {"organization_slug": slug})

        owner = User.objects.get(email=settings.DEMO_ORG_OWNER_EMAIL)
        OrganizationMember.objects.create(organization=org, user=owner, role=roles.get_top_dog().id)

        team = org.team_set.create(name=org.name)
        python_project = Project.objects.create(name="Python", organization=org, platform="python")
        python_project.add_team(team)

        react_project = Project.objects.create(
            name="React", organization=org, platform="javascript-react"
        )
        react_project.add_team(team)
        # delete all DSNs for the org so people don't send events
        ProjectKey.objects.filter(project__organization=org).delete()

        # we'll be adding transactions later
        Project.objects.filter(organization=org).update(
            flags=F("flags").bitor(Project.flags.has_transactions)
        )

    logger.info(
        "create_demo_org.post-transaction",
        extra={"organization_slug": org.slug, "quick": quick},
    )
    try:
        handle_react_python_scenario(react_project, python_project, quick=quick)
    except Exception as e:
        logger.error(
            "create_demo_org.population_error",
            extra={"organization_slug": org.slug, "quick": quick, "error": str(e)},
        )
        # delete the organization if data population fails
        org.status = OrganizationStatus.PENDING_DELETION
        org.save()
        delete_organization.apply_async(kwargs={"object_id": org.id})
        raise

    # update the org status now that it's populated
    demo_org.status = DemoOrgStatus.PENDING
    demo_org.save()

    return org


def assign_demo_org() -> Tuple[Organization, User]:
    from .tasks import build_up_org_buffer

    demo_org = None
    # option to skip the buffer when testing things out locally
    if settings.DEMO_NO_ORG_BUFFER:
        org = create_demo_org()
    else:
        demo_org = DemoOrganization.objects.filter(status=DemoOrgStatus.PENDING).first()
        # if no org in buffer, make a quick one with fewer events
        if not demo_org:
            org = create_demo_org(quick=True)

    if not demo_org:
        demo_org = DemoOrganization.objects.get(organization=org)

    org = demo_org.organization

    # wrap the assignment of the demo org in a transaction
    with transaction.atomic():
        email = create_fake_email(org.slug, "demo")
        user = DemoUser.create_user(
            email=email,
            username=email,
            is_managed=True,
        )

        # TODO: May need logic in case team no longer exists
        team = Team.objects.get(organization=org)

        member = OrganizationMember.objects.create(organization=org, user=user, role="member")
        OrganizationMemberTeam.objects.create(team=team, organizationmember=member, is_active=True)

        # update the date added to now so we reset the timer on deletion
        demo_org.mark_assigned()

    # build up the buffer
    build_up_org_buffer.apply_async()

    return (org, user)
