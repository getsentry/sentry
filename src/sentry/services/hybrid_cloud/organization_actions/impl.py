from typing import Optional, TypedDict, Union

from django.db import transaction
from django.db.models.expressions import CombinedExpression

from sentry.models import Organization, OrganizationStatus, outbox_context


class OrganizationCreateAndUpdateOptions(TypedDict, total=False):
    name: str
    slug: str
    status: OrganizationStatus
    flags: Union[CombinedExpression, int]
    default_role: str


def create_organization_with_outbox_message(
    *, create_options: OrganizationCreateAndUpdateOptions
) -> Organization:
    with outbox_context(transaction.atomic()):
        org: Organization = Organization.objects.create(**create_options)
        Organization.outbox_for_update(org_id=org.id).save()
    return org


def update_organization_with_outbox_message(
    *, org_id: int, update_data: OrganizationCreateAndUpdateOptions
) -> Organization:
    with outbox_context(transaction.atomic()):
        org: Organization = Organization.objects.get(id=org_id)
        org.update(**update_data)
        Organization.outbox_for_update(org_id=org.id).save()

    org.refresh_from_db()
    return org


def upsert_organization_by_org_id_with_outbox_message(
    *, org_id: int, upsert_data: OrganizationCreateAndUpdateOptions
) -> Organization:
    with outbox_context(transaction.atomic()):
        org, created = Organization.objects.update_or_create(id=org_id, defaults=upsert_data)
        Organization.outbox_for_update(org_id=org_id).save()
        return org


def mark_organization_as_pending_deletion_with_outbox_message(
    *, org_id: int
) -> Optional[Organization]:
    with outbox_context(transaction.atomic()):
        update_count = Organization.objects.filter(
            id=org_id, status=OrganizationStatus.ACTIVE
        ).update(status=OrganizationStatus.PENDING_DELETION)

        if not update_count:
            return None

        assert update_count == 1
        Organization.outbox_for_update(org_id=org_id).save()

        org = Organization.objects.get(id=org_id)
        return org


def unmark_organization_as_pending_deletion_with_outbox_message(
    *, org_id: int
) -> Optional[Organization]:
    with outbox_context(transaction.atomic()):
        update_count = Organization.objects.filter(
            id=org_id,
            status__in=[
                OrganizationStatus.PENDING_DELETION,
                OrganizationStatus.DELETION_IN_PROGRESS,
            ],
        ).update(status=OrganizationStatus.ACTIVE)

        if not update_count:
            return None

        assert update_count == 1
        Organization.outbox_for_update(org_id=org_id).save()

        org = Organization.objects.get(id=org_id)
        return org
