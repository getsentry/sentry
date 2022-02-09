from django.db import models

from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    DefaultFieldsModel,
    EncryptedJsonField,
    FlexibleForeignKey,
)


class OrganizationIntegration(DefaultFieldsModel):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    integration = FlexibleForeignKey("sentry.Integration")
    config = EncryptedJsonField(default=dict)

    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE, choices=ObjectStatus.as_choices()
    )
    # After the grace period, we will mark the status as disabled.
    grace_period_end = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationintegration"
        unique_together = (("organization", "integration"),)
