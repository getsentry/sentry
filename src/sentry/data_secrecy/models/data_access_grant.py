from enum import StrEnum

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
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
        max_length=20, choices=[(t.value, t.value) for t in RevocationReason]
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
