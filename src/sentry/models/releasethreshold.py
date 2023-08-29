from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model


@region_silo_only_model
class ReleaseThreshold(Model):
    __relocation_scope__ = RelocationScope.Excluded

    class ReleaseThresholdType(models.TextChoices):
        TOTAL_ERROR_COUNT = "TEC", _("Total Error Count")
        NEW_ISSUE_COUNT = "NIC", _("New Issue Count")
        UNHANDLED_ISSUE_COUNT = "UIC", _("Unhandled Issue Count")
        REGRESSED_ISSUE_COUNT = "RIC", _("Regressed Issue Count")
        FAILURE_RATE = "FR", _("Failure Rate")
        CRASH_FREE_SESSION_RATE = "CFSR", _("Crash Free Session Rate")
        CRASH_FREE_USER_RATE = "CFUR", _("Crash Free User Rate")

    class ValueType(models.TextChoices):
        PERCENT_OVER = "PO", _("Percent Over")
        PERCENT_UNDER = "PU", _("Percent Under")
        ABSOLUTE_OVER = "AO", _("Absolute Over")
        ABSOLUTE_UNDER = "AU", _("Absolute Under")

    threshold_type = models.CharField(choices=ReleaseThresholdType.choices, max_length=120)
    value_type = models.CharField(choices=ValueType.choices, max_length=120)
    value = models.IntegerField()
    window = models.IntegerField()  # in seconds

    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey("sentry.Environment", null=True)
    date_added = models.DateTimeField(default=timezone.now)
