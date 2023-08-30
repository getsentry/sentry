from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)


class ReleaseThresholdType:
    TOTAL_ERROR_COUNT = 0
    NEW_ISSUE_COUNT = 1
    UNHANDLED_ISSUE_COUNT = 2
    REGRESSED_ISSUE_COUNT = 3
    FAILURE_RATE = 4
    CRASH_FREE_SESSION_RATE = 5
    CRASH_FREE_USER_RATE = 6

    @classmethod
    def as_choices(cls):
        return (
            (cls.TOTAL_ERROR_COUNT, "Total Error Count"),
            (cls.NEW_ISSUE_COUNT, "New Issue Count"),
            (cls.UNHANDLED_ISSUE_COUNT, "Unhandled Issue Count"),
            (cls.REGRESSED_ISSUE_COUNT, "Regressed Issue Count"),
            (cls.FAILURE_RATE, "Failure Rate"),
            (cls.CRASH_FREE_SESSION_RATE, "Crash Free Session Rate"),
            (cls.CRASH_FREE_USER_RATE, "Crash Free User Rate"),
        )


class ValueType:
    PERCENT_OVER = 0
    PERCENT_UNDER = 1
    ABSOLUTE_OVER = 2
    ABSOLUTE_UNDER = 3

    @classmethod
    def as_choices(cls):
        return (
            (cls.PERCENT_OVER, "Percent Over"),
            (cls.PERCENT_UNDER, "Percent Under"),
            (cls.ABSOLUTE_OVER, "Absolute Over"),
            (cls.ABSOLUTE_UNDER, "Absolute Under"),
        )


@region_silo_only_model
class ReleaseThreshold(Model):
    __relocation_scope__ = RelocationScope.Excluded

    threshold_type = BoundedPositiveIntegerField(choices=ReleaseThresholdType.as_choices())
    threshold_trigger_type = BoundedPositiveIntegerField(choices=ValueType.as_choices())
    threshold_value = models.IntegerField()
    window_in_seconds = models.IntegerField()

    project = FlexibleForeignKey("sentry.Project", db_index=True)
    environment = FlexibleForeignKey("sentry.Environment", null=True, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
