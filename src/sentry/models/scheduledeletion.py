from __future__ import annotations

import logging
from datetime import timedelta
from typing import Type
from uuid import uuid4

from django.apps import apps
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    JSONField,
    Model,
    control_silo_only_model,
    region_silo_only_model,
)
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import SiloMode

delete_logger = logging.getLogger("sentry.deletions.api")


def default_guid():
    return uuid4().hex


def default_date_schedule():
    return timezone.now() + timedelta(days=30)


class BaseScheduledDeletion(Model):
    """
    ScheduledDeletions are, well, relations to arbitrary records in a particular silo that are due for deletion by
    the tasks/deletion/scheduled.py job in the future.  They are cancellable, and provide automatic, batched cascade
    in an async way for performance reasons.

    Note that BOTH region AND control silos need to be able to schedule deletions of different records that will be
    reconciled in different places.  For that reason, the ScheduledDeletion model is split into two identical models
    representing this split.  Use the corresponding ScheduledDeletion based on the silo of the model being scheduled
    for deletion.
    """

    class Meta:
        abstract = True

    __include_in_export__ = False

    guid = models.CharField(max_length=32, unique=True, default=default_guid)
    app_label = models.CharField(max_length=64)
    model_name = models.CharField(max_length=64)
    object_id = BoundedBigIntegerField()
    date_added = models.DateTimeField(default=timezone.now)
    date_scheduled = models.DateTimeField(default=default_date_schedule)
    actor_id = BoundedBigIntegerField(null=True)
    data = JSONField(default={})
    in_progress = models.BooleanField(default=False)

    @classmethod
    def schedule(cls, instance, days=30, hours=0, data=None, actor=None):
        model = type(instance)
        silo_mode = SiloMode.get_current_mode()
        if silo_mode not in model._meta.silo_limit.modes and silo_mode != SiloMode.MONOLITH:
            # Pre-empt the fact that our silo protections wouldn't fire for mismatched model <-> silo deletion objects.
            raise model._meta.silo_limit.AvailabilityError(
                f"{model!r} was scheduled for deletion by {cls!r}, but is unavailable in {silo_mode!r}"
            )

        model_name = model.__name__
        record, created = cls.objects.create_or_update(
            app_label=instance._meta.app_label,
            model_name=model_name,
            object_id=instance.pk,
            values={
                "date_scheduled": timezone.now() + timedelta(days=days, hours=hours),
                "data": data or {},
                "actor_id": actor.id if actor else None,
            },
        )
        if not created:
            record = cls.objects.get(
                app_label=instance._meta.app_label,
                model_name=model_name,
                object_id=instance.pk,
            )

        delete_logger.info(
            "object.delete.queued",
            extra={
                "object_id": instance.id,
                "transaction_id": record.guid,
                "model": type(instance).__name__,
            },
        )
        return record

    @classmethod
    def cancel(cls, instance):
        model_name = type(instance).__name__
        try:
            deletion = cls.objects.get(
                model_name=model_name, object_id=instance.pk, in_progress=False
            )
        except cls.DoesNotExist:
            delete_logger.info(
                "object.delete.canceled.failed",
                extra={"object_id": instance.pk, "model": model_name},
            )
            return

        deletion.delete()
        delete_logger.info(
            "object.delete.canceled",
            extra={"object_id": instance.pk, "model": model_name},
        )

    def get_model(self):
        return apps.get_model(self.app_label, self.model_name)

    def get_instance(self):
        return self.get_model().objects.get(pk=self.object_id)

    def get_actor(self) -> RpcUser | None:
        if not self.actor_id:
            return None

        return user_service.get_user(user_id=self.actor_id)


@control_silo_only_model
class ScheduledDeletion(BaseScheduledDeletion):
    """
    This model schedules deletions to be processed in control and monolith silo modes.  All historic schedule deletions
    occur in this table.  In the future, when RegionScheduledDeletions have proliferated for the appropriate models,
    we will allow any region models scheduled in this table to finish processing before ensuring that all models discretely
    process in either this table or the region table.
    """

    class Meta:
        unique_together = (("app_label", "model_name", "object_id"),)
        app_label = "sentry"
        db_table = "sentry_scheduleddeletion"


@region_silo_only_model
class RegionScheduledDeletion(BaseScheduledDeletion):
    """
    This model schedules deletions to be processed in region and monolith silo modes.  As new region silo test coverage
    increases, new scheduled deletions will begin to occur in this table.  Monolith (current saas) will continue
    processing them alongside the original scheduleddeletions table, but in the future this table will only be
    processed by region silos.
    """

    class Meta:
        unique_together = (("app_label", "model_name", "object_id"),)
        app_label = "sentry"
        db_table = "sentry_regionscheduleddeletion"


def get_regional_scheduled_deletion(mode: SiloMode) -> Type[BaseScheduledDeletion]:
    if mode == SiloMode.REGION:
        return RegionScheduledDeletion
    return ScheduledDeletion
