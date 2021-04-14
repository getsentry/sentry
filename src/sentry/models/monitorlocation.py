from django.db import models
from django.utils import timezone

from sentry.db.models import BaseManager, Model, UUIDField, sane_repr


class MonitorLocation(Model):
    __core__ = True

    guid = UUIDField(unique=True, auto_add=True)
    name = models.CharField(max_length=128)
    date_added = models.DateTimeField(default=timezone.now)
    objects = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorlocation"

    __repr__ = sane_repr("guid", "name")
