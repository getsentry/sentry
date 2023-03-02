from django.db import models
from django.db.models import Q
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.models.monitor import MonitorFailure, MonitorStatus


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

    def mark_failed(self, last_checkin=None, reason=MonitorFailure.UNKNOWN):
        if last_checkin is None:
            next_checkin_base = timezone.now()
            last_checkin = self.last_checkin or timezone.now()
        else:
            next_checkin_base = last_checkin

        new_status = MonitorStatus.ERROR
        if reason == MonitorFailure.MISSED_CHECKIN:
            new_status = MonitorStatus.MISSED_CHECKIN

        affected = (
            type(self)
            .objects.filter(
                Q(last_checkin__lte=last_checkin) | Q(last_checkin__isnull=True), id=self.id
            )
            .update(
                next_checkin=self.monitor.get_next_scheduled_checkin(next_checkin_base),
                status=new_status,
                last_checkin=last_checkin,
            )
        )
        if not affected:
            return False

        return True
