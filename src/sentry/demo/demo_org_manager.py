from django.utils import timezone
from typing import Tuple

from sentry.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    Team,
)
from sentry.utils.email import create_fake_email

from .tasks import build_up_org_buffer
from .utils import NoDemoOrgReady


def assign_demo_org() -> Tuple[Organization, User]:
    org = Organization.objects.filter(status=OrganizationStatus.WAITING_DEMO_ASSIGNMENT).first()
    if not org:
        raise NoDemoOrgReady()

    email = create_fake_email(org.slug, "demo")
    user = User.objects.create(
        email=email,
        username=email,
        is_managed=True,
        flags=User.flags["demo_mode"],
    )

    # TODO: May need logic in case team no longer exists
    team = Team.objects.get(organization=org)

    member = OrganizationMember.objects.create(organization=org, user=user, role="member")
    OrganizationMemberTeam.objects.create(team=team, organizationmember=member, is_active=True)

    # update the date added to now so we reset the timer on deletion
    org.date_added = timezone.now()
    org.status = OrganizationStatus.ACTIVE
    org.save()

    # build up the buffer
    build_up_org_buffer.apply_async()

    return (org, user)
