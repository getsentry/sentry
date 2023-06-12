from typing import TypedDict

from django.db import transaction
from django.db.models.expressions import CombinedExpression

from sentry.models import Organization, OrganizationStatus


class OrganizationCreateAndUpdateOptions(TypedDict, total=False):
    name: str
    slug: str
    status: OrganizationStatus
    flags: CombinedExpression
    default_role: int


def create_organization_with_outbox_message(
    *, create_options: OrganizationCreateAndUpdateOptions
) -> Organization:
    with transaction.atomic():
        org: Organization = Organization.objects.create(**create_options)
        Organization.outbox_for_update(org_id=org.id).save()
    return org


def update_organization_with_outbox_message(
    *, org_id: int, update_data: OrganizationCreateAndUpdateOptions
) -> Organization:
    with transaction.atomic():
        org: Organization = Organization.objects.get(id=org_id)
        org.update(**update_data)
        Organization.outbox_for_update(org_id=org.id).save()

    org.refresh_from_db()
    return org


def upsert_organization_by_org_id_with_outbox_message(
    *, org_id: int, upsert_data: OrganizationCreateAndUpdateOptions
) -> Organization:
    with transaction.atomic():
        org, created = Organization.objects.update_or_create(id=org_id, defaults=upsert_data)
        Organization.outbox_for_update(org_id=org_id).save()
        return org
