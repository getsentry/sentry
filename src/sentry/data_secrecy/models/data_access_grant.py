from datetime import datetime
from enum import StrEnum

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.data_secrecy.cache import effective_grant_status_cache
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, control_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_model
class DataAccessGrant(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    class GrantType(StrEnum):
        ZENDESK = "zendesk"
        MANUAL = "manual"

    class RevocationReason(StrEnum):
        TICKET_RESOLVED = "ticket_resolved"
        MANUAL_REVOCATION = "manual_revocation"

    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    grant_type = models.CharField(max_length=24, choices=[(t.value, t.value) for t in GrantType])

    ticket_id = models.CharField(max_length=64, null=True)

    # For MANUAL type grants, store the user who granted the access
    granted_by_user = FlexibleForeignKey(
        "sentry.User",
        null=True,
        on_delete=models.SET_NULL,
        related_name="granted_data_access_grants",
    )

    # Access window for the grant
    grant_start = models.DateTimeField(default=timezone.now)
    grant_end = models.DateTimeField(default=timezone.now)

    # If the grant is revoked, we store the date and reason
    revocation_date = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(
        max_length=20, choices=[(t.value, t.value) for t in RevocationReason], null=True, blank=True
    )

    # If the grant is manually revoked record the user who revoked it
    revoked_by_user = FlexibleForeignKey(
        "sentry.User",
        null=True,
        on_delete=models.SET_NULL,
        related_name="revoked_data_access_grants",
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dataaccessgrant"
        unique_together = (("organization_id", "grant_type", "ticket_id"),)

    @classmethod
    def create_data_access_grant(
        cls,
        organization_id: int,
        user_id: int | None,
        grant_type: GrantType,
        access_end: datetime,
    ) -> None:
        cls.objects.create(
            organization_id=organization_id,
            grant_type=grant_type,
            grant_start=timezone.now(),
            grant_end=access_end,
            granted_by_user_id=user_id,
        )

        # invalidate cache to force effective grant status recalculation
        effective_grant_status_cache.delete(organization_id)

    @classmethod
    def revoke_active_data_access_grants(
        cls, organization_id: int, user_id: int | None, revocation_reason: RevocationReason
    ) -> None:
        now = timezone.now()

        cls.objects.filter(
            organization_id=organization_id,
            grant_start__lte=now,
            grant_end__gt=now,
            revocation_date__isnull=True,  # Not revoked
        ).update(
            revocation_date=now,
            revocation_reason=revocation_reason,
            revoked_by_user_id=user_id,
        )

        # invalidate cache to force effective grant status recalculation
        effective_grant_status_cache.delete(organization_id)


def get_active_tickets_for_organization(organization_id: int) -> list[str]:
    """
    Separate function to get ticket info for UI display.
    Called only when needed (not on every access check).
    Fast query since we can filter by time.
    """
    now = timezone.now()
    active_zendesk_tickets = DataAccessGrant.objects.filter(
        organization_id=organization_id,
        grant_type=DataAccessGrant.GrantType.ZENDESK,
        grant_start__lte=now,
        grant_end__gt=now,
        revocation_date__isnull=True,
        ticket_id__isnull=False,
    ).values_list("ticket_id", flat=True)
    return [ticket_id for ticket_id in active_zendesk_tickets if ticket_id is not None]
