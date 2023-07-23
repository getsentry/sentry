from typing import Optional, Tuple, TypedDict

from django.db import router, transaction
from django.db.models.expressions import CombinedExpression

from sentry import roles
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    outbox_context,
)


class OrganizationCreateAndUpdateOptions(TypedDict, total=False):
    name: str
    slug: str
    status: OrganizationStatus
    flags: CombinedExpression
    default_role: int


def create_organization_with_outbox_message(
    *, create_options: OrganizationCreateAndUpdateOptions
) -> Organization:
    org: Organization = Organization.objects.create(**create_options)
    return org


def create_organization_and_member_for_monolith(
    organization_name,
    user_id,
    slug: str,
) -> Tuple[Organization, OrganizationMember]:
    org = create_organization_with_outbox_message(
        create_options={"name": organization_name, "slug": slug}
    )

    team = org.team_set.create(name=org.name)

    om = OrganizationMember.objects.create(
        user_id=user_id, organization=org, role=roles.get_top_dog().id
    )

    OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)

    return org, om


def update_organization_with_outbox_message(
    *, org_id: int, update_data: OrganizationCreateAndUpdateOptions
) -> Organization:
    with outbox_context(transaction.atomic(router.db_for_write(Organization))):
        org: Organization = Organization.objects.get(id=org_id)
        org.update(**update_data)

        org.refresh_from_db()
        return org


def upsert_organization_by_org_id_with_outbox_message(
    *, org_id: int, upsert_data: OrganizationCreateAndUpdateOptions
) -> Organization:
    with outbox_context(transaction.atomic(router.db_for_write(Organization))):
        org, created = Organization.objects.update_or_create(id=org_id, defaults=upsert_data)
        return org


def mark_organization_as_pending_deletion_with_outbox_message(
    *, org_id: int
) -> Optional[Organization]:
    with outbox_context(transaction.atomic(router.db_for_write(Organization))):
        update_count = Organization.objects.filter(
            id=org_id, status=OrganizationStatus.ACTIVE
        ).update(status=OrganizationStatus.PENDING_DELETION)

        if not update_count:
            return None

        Organization.outbox_for_update(org_id=org_id).save()

        org = Organization.objects.get(id=org_id)
        return org


def unmark_organization_as_pending_deletion_with_outbox_message(
    *, org_id: int
) -> Optional[Organization]:
    with outbox_context(transaction.atomic(router.db_for_write(Organization))):
        update_count = Organization.objects.filter(
            id=org_id,
            status__in=[
                OrganizationStatus.PENDING_DELETION,
                OrganizationStatus.DELETION_IN_PROGRESS,
            ],
        ).update(status=OrganizationStatus.ACTIVE)

        if not update_count:
            return None

        Organization.outbox_for_update(org_id=org_id).save()

        org = Organization.objects.get(id=org_id)
        return org
