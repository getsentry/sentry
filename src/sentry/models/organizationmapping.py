from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from django.db import models
from django.utils import timezone

from sentry import roles
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, sane_repr
from sentry.db.models.base import Model, control_silo_only_model
from sentry.models.organization import OrganizationStatus
from sentry.services.hybrid_cloud import IDEMPOTENCY_KEY_LENGTH, REGION_NAME_LENGTH

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.organization import RpcOrganizationMappingFlags


@control_silo_only_model
class OrganizationMapping(Model):
    """
    This model is used to:
    * Map org slugs to a specific organization and region
    * Safely reserve organization slugs via an eventually consistent cross silo workflow
    """

    # This model is "autocreated" via an outbox write from the regional `Organization` it
    # references, so there is no need to explicitly include it in the export.
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True, unique=True)
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=64)
    date_created = models.DateTimeField(default=timezone.now)
    customer_id = models.CharField(max_length=255, db_index=True, null=True)
    verified = models.BooleanField(default=False)
    # If a record already exists with the same slug, the organization_id can only be
    # updated IF the idempotency key is identical.
    idempotency_key = models.CharField(max_length=IDEMPOTENCY_KEY_LENGTH)
    region_name = models.CharField(max_length=REGION_NAME_LENGTH)
    status = BoundedBigIntegerField(choices=OrganizationStatus.as_choices(), null=True)

    # Replicated from the Organization.flags attribute
    allow_joinleave = models.BooleanField(default=False)
    enhanced_privacy = models.BooleanField(default=False)
    require_2fa = models.BooleanField(default=False)
    early_adopter = models.BooleanField(default=False)
    disable_shared_issues = models.BooleanField(default=False)
    disable_new_visibility_features = models.BooleanField(default=False)
    require_email_verification = models.BooleanField(default=False)
    codecov_access = models.BooleanField(default=False)

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
        from sentry.models.organizationmembermapping import OrganizationMemberMapping

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

    @property
    def flags(self) -> RpcOrganizationMappingFlags:
        from sentry.services.hybrid_cloud.organization_mapping.serial import (
            serialize_organization_mapping_flags,
        )

        return serialize_organization_mapping_flags(self)
