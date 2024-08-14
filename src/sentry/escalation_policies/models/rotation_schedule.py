from datetime import datetime
from datetime import timezone as tz

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.organization import Organization


@region_silo_model
class RotationSchedule(models.Model):
    """Schedules consist of layers. Each layer has an ordered user rotation and has corresponding
    rotation times and restrictions. The layers are then superimposed with higher layers
    having higher precedence resulting in a single materialized schedule.

    For example, This structure allows you to schedule a 24 hour coverage rotation with 3 eight hour shifts from
    different places.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=256, unique=True)
    # Owner is team or user
    team = FlexibleForeignKey(
        "sentry.Team", null=True, on_delete=models.SET_NULL, related_name="schedules"
    )
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rotation_schedule"


class RotationScheduleLayerRotationType(models.TextChoices):
    DAILY = "daily", gettext_lazy("Daily")
    WEEKLY = "weekly", gettext_lazy("Weekly")
    FORTNIGHTLY = "fortnightly", gettext_lazy("Fortnightly")
    MONTHLY = "monthly", gettext_lazy("Monthly")


@region_silo_model
class RotationScheduleLayer(models.Model):
    __relocation_scope__ = RelocationScope.Organization

    # each layer that gets created has a higher precedence overriding lower layers
    schedule = models.ForeignKey(RotationSchedule, on_delete=models.CASCADE, related_name="layers")
    precedence = models.PositiveIntegerField()
    rotation_type = models.CharField(
        max_length=20, choices=RotationScheduleLayerRotationType.choices
    )
    # %% Validate that for:
    # %% Daily: cron is just a time
    # %% Weekly: cron is a weekday and time
    # %% Fortnightly: cron is a weekday and time
    # %% Monthly: cron is a day of month and a time
    handoff_time = models.CharField(max_length=20)
    """
    {
        "Sun": [["08:00", "10:00"]],
        "Mon": [["08:00", "17:00"]],
        "Tues": [["08:00", "17:00"]],
        ...
    }
    """
    schedule_layer_restrictions = models.JSONField()
    start_time = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rotation_schedule_layer"
        unique_together = ("schedule_id", "precedence")
        ordering = ("precedence",)


@region_silo_model
class RotationScheduleUserOrder(models.Model):
    schedule_layer = models.ForeignKey(
        RotationScheduleLayer, on_delete=models.CASCADE, related_name="user_orders"
    )
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="CASCADE")
    order = models.PositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rotation_schedule_layer_user_order"
        unique_together = ("schedule_layer", "user_id")


@region_silo_model
class RotationScheduleOverride(models.Model):
    __relocation_scope__ = RelocationScope.Organization

    rotation_schedule = models.ForeignKey(
        RotationSchedule, on_delete=models.CASCADE, related_name="overrides"
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="CASCADE")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rotation_schedule_override"


DEFAULT_ROTATION_START_TIME = datetime(2020, 1, 1).replace(tzinfo=tz.utc)
