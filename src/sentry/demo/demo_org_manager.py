from django.conf import settings
from django.db import transaction
from django.template.defaultfilters import slugify
from typing import Tuple

from sentry import roles
from sentry.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectKey,
    Team,
)
from sentry.utils.email import create_fake_email

from .data_population import populate_python_project, populate_react_project
from .utils import NoDemoOrgReady, generate_random_name
from .models import DemoUser, DemoOrganization, DemoOrgStatus


@transaction.atomic
def create_demo_org() -> None:
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


@transaction.atomic
def assign_demo_org() -> Tuple[Organization, User]:
    from .tasks import build_up_org_buffer

    demo_org = DemoOrganization.objects.filter(status=DemoOrgStatus.PENDING).first()
    if not demo_org:
        raise NoDemoOrgReady()

    org = demo_org.organization

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
