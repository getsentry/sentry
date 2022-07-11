from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class ActiveReleaseActivityType(Enum):
    STARTED = 1
    FINISHED = 2
    NEW_ISSUE = 3
    REGRESSION = 4


class ActiveReleaseActivity(Model):
    __include_in_export__ = True

    release = FlexibleForeignKey("sentry.Release")
    type = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_activereleaseactivity"
