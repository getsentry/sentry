import logging
from typing import Tuple

import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.template.defaultfilters import slugify

from sentry import roles
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    Project,
    ProjectKey,
    Team,
    User,
)
from sentry.tasks.deletion import delete_organization
from sentry.utils.email import create_fake_email

from .data_population import handle_react_python_scenario, populate_org_members
from .models import DemoOrganization, DemoOrgStatus, DemoUser
from .utils import generate_random_name

logger = logging.getLogger(__name__)


def create_demo_org(quick=False) -> Organization:
    with sentry_sdk.start_transaction(op="create_demo_org", name="create_demo_org", sampled=True):
        sentry_sdk.set_tag("quick", quick)
        # wrap the main org setup in transaction
        with transaction.atomic():
            name = generate_random_name()

            slug = slugify(name)

            demo_org = DemoOrganization.create_org(name=name, slug=slug)
            org = demo_org.organization

            logger.info("create_demo_org.created_org", {"organization_slug": slug})

            owner = User.objects.get(email=settings.DEMO_ORG_OWNER_EMAIL)
            OrganizationMember.objects.create(
                organization=org, user=owner, role=roles.get_top_dog().id
            )

            team = org.team_set.create(name=org.name)
            python_project = Project.objects.create(
                name="Python", organization=org, platform="python"
            )
            python_project.add_team(team)

            react_project = Project.objects.create(
                name="React", organization=org, platform="javascript-react"
            )
            react_project.add_team(team)

            populate_org_members(org, team)

            # we'll be adding transactions later
            Project.objects.filter(organization=org).update(
                flags=F("flags").bitor(Project.flags.has_transactions)
            )

        logger.info(
            "create_demo_org.post-transaction",
            extra={"organization_slug": org.slug, "quick": quick},
        )

        with sentry_sdk.start_span(op="handle_react_python_scenario"):
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

        logger.info(
            "create_demo_org.complete",
            extra={"organization_slug": org.slug, "quick": quick},
        )

        return org


def assign_demo_org(skip_buffer=False, retries_left=3) -> Tuple[Organization, User]:
    with sentry_sdk.configure_scope() as scope:
        try:
            parent_span_id = scope.span.span_id
            trace_id = scope.span.trace_id
        except AttributeError:
            parent_span_id = None
            trace_id = None
    with sentry_sdk.start_transaction(
        op="assign_demo_org",
        name="assign_demo_org",
        parent_span_id=parent_span_id,
        trace_id=trace_id,
        sampled=True,
    ):
        from .tasks import build_up_org_buffer

        demo_org = None
        # option to skip the buffer when testing things out
        if skip_buffer:
            org = create_demo_org(quick=True)
        else:
            demo_org = DemoOrganization.get_one_pending_org()
            # if no org in buffer, make a quick one with fewer events
            if not demo_org:
                org = create_demo_org(quick=True)

        if not demo_org:
            demo_org = DemoOrganization.objects.get(organization=org)

        org = demo_org.organization

        # wrap the assignment of the demo org in a transaction
        with transaction.atomic():
            email = create_fake_email(org.slug, "demo")
            try:
                user = DemoUser.create_user(
                    email=email,
                    username=email,
                    is_managed=True,
                )
            except IntegrityError:
                # There is a race condition where two people might try to reserve the same organization
                # at the same time. If that happens, we get IntegrityError creating the user.
                # If that happens, try the same thing (which will give us a new org) but only up to 3 times
                if retries_left == 0:
                    raise
                return assign_demo_org(skip_buffer=skip_buffer, retries_left=retries_left - 1)

            # TODO: May need logic in case team no longer exists
            team = Team.objects.get(organization=org)

            member = OrganizationMember.objects.create(organization=org, user=user, role="member")
            OrganizationMemberTeam.objects.create(
                team=team, organizationmember=member, is_active=True
            )

            # delete all DSNs for the org so people don't send events
            ProjectKey.objects.filter(project__organization=org).delete()

            # update the date added to now so we reset the timer on deletion
            demo_org.mark_assigned()

        # build up the buffer
        build_up_org_buffer.apply_async()

        return (org, user)
