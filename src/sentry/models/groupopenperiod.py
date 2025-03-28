from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeBoundary, RangeOperators
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class TsTzRange(models.Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


@region_silo_model
class GroupOpenPeriod(DefaultFieldsModel):
    """
    A GroupOpenPeriod is a period of time where a group is considered "open",
    i.e. having a status that is not resolved. This is primarily used for
    detector-based issues to track the period of time that an issue is open for.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group")
    resolution_activity = FlexibleForeignKey(
        "sentry.Activity", null=True, on_delete=models.SET_NULL
    )

    # if the user is not set, it's assumed to be the system
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    date_started = models.DateTimeField(default=timezone.now)
    date_ended = models.DateTimeField(null=True)

    data = models.JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupopenperiod"
        indexes = (
            # get all open periods since a certain date
            models.Index(fields=("group", "date_started")),
        )
        constraints = (
            ExclusionConstraint(
                name="exclude_open_period_overlap",
                expressions=[
                    (
                        TsTzRange("date_started", "date_ended", RangeBoundary()),
                        RangeOperators.OVERLAPS,
                    )
                ],
            ),
        )

    __repr__ = sane_repr("project_id", "group_id", "date_started", "date_ended", "user_id")
