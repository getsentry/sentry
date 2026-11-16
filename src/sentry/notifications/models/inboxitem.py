from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class InboxItem(DefaultFieldsModel):
    """
    A subject (such as an issue or investigation) in a user's inbox for an organization.

    There is one item per user, organization and subject. Each thing that happens to the subject
    is recorded as an InboxItemEvent on the item.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    # The recipient of the inbox item
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE", db_index=False)

    # The type of the subject (e.g. "issue", "investigation") and its ID.
    subject_type = models.CharField(max_length=32)
    subject_id = models.CharField(max_length=64)

    # Timestamp of the latest inbox item event.
    last_activity_at = models.DateTimeField()
    # Timestamp of the last time the user read the inbox item.
    last_read_at = models.DateTimeField(null=True)

    status = models.SmallIntegerField(db_default=ObjectStatus.ACTIVE)

    class Meta:
        app_label = "notifications"
        db_table = "notifications_inboxitem"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "organization", "subject_type", "subject_id"],
                name="inboxitem_user_subject_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "user_id", "-last_activity_at"],
                name="inboxitem_user_activity_idx",
            ),
            models.Index(
                fields=["organization", "subject_type", "subject_id"], name="inboxitem_subject_idx"
            ),
        ]

    __repr__ = sane_repr("id", "organization_id", "user_id", "subject_type", "subject_id")
