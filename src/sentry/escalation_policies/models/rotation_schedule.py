from datetime import UTC, datetime
from typing import TypedDict

from django.conf import settings
from django.db import models
from django.db.models.base import Model
from django.utils import timezone
from django.utils.translation import gettext_lazy

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.organization import Organization


@region_silo_model
class RotationSchedule(Model):
    """Schedules consist of layers. Each layer has an ordered user rotation and has corresponding
    rotation times and restrictions. The layers are then superimposed with higher layers
    having higher precedence resulting in a single materialized schedule.

    For example, This structure allows you to schedule a 24 hour coverage rotation with 3 eight hour shifts from
    different places.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=256)
    description = models.CharField(max_length=512, null=True, blank=True)
    # Owner is team or user
    team = FlexibleForeignKey(
        "sentry.Team", null=True, on_delete=models.SET_NULL, related_name="schedules"
    )
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    class Meta:
        app_label = "escalation_policies"
        db_table = "escalation_policies_rotation_schedule"
        unique_together = (("organization", "name"),)


class RotationScheduleLayerRotationType(models.TextChoices):
    DAILY = "daily", gettext_lazy("Daily")
    WEEKLY = "weekly", gettext_lazy("Weekly")
    FORTNIGHTLY = "fortnightly", gettext_lazy("Fortnightly")
    MONTHLY = "monthly", gettext_lazy("Monthly")


rotation_schedule_layer_rotation_type_to_days = {
    RotationScheduleLayerRotationType.DAILY: 1,
    RotationScheduleLayerRotationType.WEEKLY: 7,
    RotationScheduleLayerRotationType.FORTNIGHTLY: 14,
    RotationScheduleLayerRotationType.MONTHLY: 30,
}


@region_silo_model
class RotationScheduleLayer(Model):
    __relocation_scope__ = RelocationScope.Organization

    # each layer that gets created has a higher precedence overriding lower layers
    schedule = models.ForeignKey(RotationSchedule, on_delete=models.CASCADE, related_name="layers")
    precedence = models.PositiveIntegerField()
    rotation_type = models.CharField(
        max_length=20, choices=RotationScheduleLayerRotationType.choices
    )
    # %% Validate that this is just a time HH:MM ("%H:%M")
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

    # Must be a DATE, time is handoff time
    start_date = models.DateField(default=timezone.now)

    class Meta:
        app_label = "escalation_policies"
        db_table = "escalation_policies_rotation_schedule_layer"
        unique_together = ("schedule_id", "precedence")
        ordering = ("precedence",)


"""
    {
        "Sun": [["08:00", "10:00"]],
        "Mon": [["08:00", "17:00"]],
        "Tues": [["08:00", "17:00"]],
        ...
    }
"""


class ScheduleLayerRestriction(TypedDict, total=False):
    Sun: list[tuple[str, str]]
    Mon: list[tuple[str, str]]
    Tue: list[tuple[str, str]]
    Wed: list[tuple[str, str]]
    Thu: list[tuple[str, str]]
    Fri: list[tuple[str, str]]
    Sat: list[tuple[str, str]]


@region_silo_model
class RotationScheduleUserOrder(Model):
    schedule_layer = models.ForeignKey(
        RotationScheduleLayer, on_delete=models.CASCADE, related_name="user_orders"
    )
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="CASCADE")
    order = models.PositiveIntegerField()

    class Meta:
        app_label = "escalation_policies"
        db_table = "escalation_policies_rotation_schedule_layer_user_order"
        unique_together = ("schedule_layer", "user_id")


@region_silo_model
class RotationScheduleOverride(Model):
    __relocation_scope__ = RelocationScope.Organization

    rotation_schedule = models.ForeignKey(
        RotationSchedule, on_delete=models.CASCADE, related_name="overrides"
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="CASCADE")

    class Meta:
        app_label = "escalation_policies"
        db_table = "escalation_policies_rotation_schedule_override"


DEFAULT_ROTATION_START_TIME = datetime(2024, 1, 1, tzinfo=UTC)
