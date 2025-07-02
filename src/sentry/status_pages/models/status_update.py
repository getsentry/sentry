from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, sane_repr
from sentry.db.models.base import DefaultFieldsModelExisting, region_silo_model


@region_silo_model
class StatusUpdate(DefaultFieldsModelExisting):
    """
    A status update represents a public notice posted to a status page.
    """

    __relocation_scope__ = RelocationScope.Organization

    # Status types
    STATUS_UPDATE_TYPE_OPERATIONAL = "operational"
    STATUS_UPDATE_TYPE_DEGRADED = "degraded"
    STATUS_UPDATE_TYPE_DOWN = "down"
    STATUS_UPDATE_TYPE_MAINTENANCE = "maintenance"

    STATUS_TYPE_CHOICES = (
        (STATUS_UPDATE_TYPE_OPERATIONAL, "Operational"),
        (STATUS_UPDATE_TYPE_DEGRADED, "Degraded"),
        (STATUS_UPDATE_TYPE_DOWN, "Down"),
        (STATUS_UPDATE_TYPE_MAINTENANCE, "Scheduled Maintenance"),
    )

    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    type = models.CharField(
        max_length=20,
        choices=STATUS_TYPE_CHOICES,
    )

    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)

    status_page = FlexibleForeignKey("status_pages.StatusPage")

    # Self-referential relationship for updates to the same incident
    parent_update = FlexibleForeignKey("self", null=True, blank=True, related_name="child_updates")

    # Notification settings
    should_notify_subscribers_now = models.BooleanField(default=False)
    should_notify_subscribers_at_end = models.BooleanField(default=False)
    should_notify_subscribers_24h_before = models.BooleanField(default=False)

    class Meta:
        app_label = "status_pages"
        db_table = "sentry_status_update"

    __repr__ = sane_repr("id", "status_page_id", "title", "type")
