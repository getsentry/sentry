from __future__ import annotations

from datetime import timedelta

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


class ScheduledTriggerType(models.TextChoices):
    # target_id is a SeerWorkflowConfig id.
    SEER_WORKFLOW = "seer_workflow"


class ScheduleType(models.TextChoices):
    INTERVAL = "interval"
    CRON = "cron"


@cell_silo_model
class ScheduledTrigger(DefaultFieldsModel):
    """
    A recurring schedule for running the action registered for `trigger_type` against
    `target_id`, an identifier whose meaning depends on the trigger type.

    Interval schedules run every `interval_seconds`, anchored to when they were created.
    Cron schedules run on `cron_expression`, evaluated in `timezone`.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Indexed by the leading column of the unique constraint.
    organization = FlexibleForeignKey(
        "sentry.Organization", on_delete=models.CASCADE, db_index=False
    )
    trigger_type = models.CharField(max_length=64, choices=ScheduledTriggerType.choices)
    target_id = BoundedBigIntegerField()
    schedule_type = models.CharField(max_length=16, choices=ScheduleType.choices)
    interval_seconds = models.PositiveIntegerField(null=True)
    cron_expression = models.CharField(max_length=255, null=True)
    timezone = models.CharField(max_length=64, default="UTC", db_default="UTC")
    # NULL means the trigger is not scheduled to run.
    next_run_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "cadence"
        db_table = "cadence_scheduledtrigger"
        indexes = [models.Index(fields=["next_run_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "trigger_type", "target_id"],
                name="cadence_scheduledtrigger_org_type_target_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        schedule_type=ScheduleType.INTERVAL,
                        interval_seconds__isnull=False,
                        cron_expression__isnull=True,
                    )
                    | models.Q(
                        schedule_type=ScheduleType.CRON,
                        interval_seconds__isnull=True,
                        cron_expression__isnull=False,
                    )
                ),
                name="cadence_scheduledtrigger_schedule_fields",
            ),
        ]

    __repr__ = sane_repr(
        "organization_id", "trigger_type", "target_id", "schedule_type", "next_run_at"
    )

    @property
    def interval(self) -> timedelta | None:
        if self.interval_seconds is None:
            return None
        return timedelta(seconds=self.interval_seconds)
