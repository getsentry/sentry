from __future__ import annotations

from typing import Optional

from django.db import models
from django.utils import timezone

from sentry import roles
from sentry.db.models import BoundedBigIntegerField, Model, sane_repr
from sentry.db.models.base import control_silo_only_model
from sentry.models.organization import OrganizationStatus
from sentry.services.hybrid_cloud import IDEMPOTENCY_KEY_LENGTH, REGION_NAME_LENGTH


@control_silo_only_model
class OrganizationMapping(Model):
    """
    This model is used to:
    * Map org slugs to a specific organization and region
    * Safely reserve organization slugs via an eventually consistent cross silo workflow
    """

    __include_in_export__ = True

    organization_id = BoundedBigIntegerField(db_index=True, unique=True)
    slug = models.SlugField(unique=True)
    # TODO(hybrid-cloud): Name is currently blank for all records. Updating an org name should happen for all applicable slugs.
    name = models.CharField(max_length=64)
    date_created = models.DateTimeField(default=timezone.now)
    customer_id = models.CharField(max_length=255, db_index=True, null=True)
    verified = models.BooleanField(default=False)
    # If a record already exists with the same slug, the organization_id can only be
    # updated IF the idempotency key is identical.
    idempotency_key = models.CharField(max_length=IDEMPOTENCY_KEY_LENGTH)
    region_name = models.CharField(max_length=REGION_NAME_LENGTH)
    status = BoundedBigIntegerField(choices=OrganizationStatus.as_choices(), null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmapping"

    __repr__ = sane_repr("organization_id", "slug", "region_name", "verified")

    @staticmethod
    def find_expected_provisioned(user_id: int, slug: str) -> Optional[OrganizationMapping]:
        """
        Attempts to find an already provisioned organization by the given slug that is owned by the user_id
        Returns None if
            1.  no organization mapping exists by the given slug
            2.  no organization member mapping exists for the given org and user_id
            3.  the organization member mapping for the given org and user_id is not the owner.
        """
        from sentry.models import OrganizationMemberMapping

        try:
            mapping = OrganizationMapping.objects.get(slug=slug)
        except OrganizationMapping.DoesNotExist:
            return None

        try:
            member_mapping = OrganizationMemberMapping.objects.get(
                organization_id=mapping.organization_id, user_id=user_id
            )
        except OrganizationMemberMapping.DoesNotExist:
            return None

        if member_mapping.role != roles.get_top_dog().id:
            return None

        return mapping
