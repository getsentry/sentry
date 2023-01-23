from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BaseManager,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    UUIDField,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.jsonfield import JSONField


class CheckInStatus:
    UNKNOWN = 0
    """No status was passed"""

    OK = 1
    """Checkin had no issues during execution"""

    ERROR = 2
    """Checkin failed or otherwise had some issues"""

    IN_PROGRESS = 3
    """Checkin is expected to complete"""

    MISSED = 4
    """Monitor did not check in on time"""

    FINISHED_VALUES = (OK, ERROR)
    """Sentient values used to indicate a monitor is finished running"""

    @classmethod
    def as_choices(cls):
        return (
            (cls.UNKNOWN, "unknown"),
            (cls.OK, "ok"),
            (cls.ERROR, "error"),
            (cls.IN_PROGRESS, "in_progress"),
            (cls.MISSED, "missed"),
        )


@region_silo_only_model
class MonitorCheckIn(Model):
    __include_in_export__ = False

    guid = UUIDField(unique=True, auto_add=True)
    project_id = BoundedBigIntegerField(db_index=True)
    monitor = FlexibleForeignKey("sentry.Monitor")
    location = FlexibleForeignKey("sentry.MonitorLocation", null=True)
    status = BoundedPositiveIntegerField(
        default=CheckInStatus.UNKNOWN, choices=CheckInStatus.as_choices(), db_index=True
    )
    config = JSONField(default=dict)
    duration = BoundedPositiveIntegerField(null=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)
    objects = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorcheckin"
        indexes = [
            models.Index(fields=["monitor", "date_added", "status"]),
        ]

    __repr__ = sane_repr("guid", "project_id", "status")

    def save(self, *args, **kwargs):
        if not self.date_added:
            self.date_added = timezone.now()
        if not self.date_updated:
            self.date_updated = self.date_added
        return super().save(*args, **kwargs)

    # XXX(dcramer): BaseModel is trying to automatically set date_updated which is not
    # what we want to happen, so kill it here
    def _update_timestamps(self):
        pass
