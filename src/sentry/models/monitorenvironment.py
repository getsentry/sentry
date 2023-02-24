from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.models.monitor import MonitorStatus


@region_silo_only_model
class MonitorEnvironment(Model):
    __include_in_export__ = True

    monitor = FlexibleForeignKey("sentry.Monitor")
    environment = FlexibleForeignKey("sentry.Environment")
    status = BoundedPositiveIntegerField(
        default=MonitorStatus.ACTIVE, choices=MonitorStatus.as_choices()
    )
    next_checkin = models.DateTimeField(null=True)
    last_checkin = models.DateTimeField(null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorenvironment"
        indexes = [models.Index(fields=["monitor", "environment"])]

    __repr__ = sane_repr("monitor_id", "environment_id")
