import hashlib
from typing import Optional

from django.db import router, transaction
from django.db.models.expressions import CombinedExpression
from django.utils.text import slugify
from typing_extensions import TypedDict

from sentry import roles
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    outbox_context,
)
from sentry.services.hybrid_cloud.organization_actions.model import (
    OrganizationAndMemberCreationResult,
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
    organization_name: str,
    user_id: int,
    slug: str,
) -> OrganizationAndMemberCreationResult:
    org = create_organization_with_outbox_message(
        create_options={"name": organization_name, "slug": slug}
    )

    team = org.team_set.create(name=org.name)

    om = OrganizationMember.objects.create(
        user_id=user_id, organization=org, role=roles.get_top_dog().id
    )

    OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)

    return OrganizationAndMemberCreationResult(organization=org, org_member=om, team=team)


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


def generate_deterministic_organization_slug(
    *, desired_slug_base: str, desired_org_name: str, owning_user_id: int
) -> str:
    """
    Generates a slug suffixed with a hash of the provided params, intended for
    idempotent organization provisioning via the organization_provisioning RPC
    service
    :param desired_slug_base: the slug seed, which will be the slug prefix
    :param desired_org_name:
    :param owning_user_id:
    :return:
    """

    # Start by slugifying the original name using django utils
    slugified_base_str = slugify(desired_slug_base)

    assert len(slugified_base_str) > 0, "Slugs must be valid strings that can be ASCII encoded"

    hashed_org_data = hashlib.md5(
        "/".join([slugified_base_str, desired_org_name, str(owning_user_id)]).encode("utf8")
    ).hexdigest()

    return f"{slugified_base_str[:20]}-{hashed_org_data[:9]}"
