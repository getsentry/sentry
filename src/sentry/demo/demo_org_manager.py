from django.db import transaction
from typing import Tuple

from sentry.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
)
from sentry.utils.email import create_fake_email

from .tasks import build_up_org_buffer
from .utils import NoDemoOrgReady
from .models import DemoUser, DemoOrganization, DemoOrgStatus


@transaction.atomic
def assign_demo_org() -> Tuple[Organization, User]:
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
