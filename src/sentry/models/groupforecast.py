from django.db import models
from django.utils import timezone

from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)


@region_silo_only_model
class GroupForecast(Model):
    """
    Stores the forecast of expected counts of events for a Group

    ``forecast`` will hold an array of integers. The length of the array
    is the difference between `date_created` and `valid_until`. Each integer
    maps to the days in the range of `date_created` and `valid_until`.

    """

    __include_in_export__ = False

    group = FlexibleForeignKey("sentry.Group", unique=True)
    forecast = ArrayField(of=BoundedPositiveIntegerField, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupforecast"
