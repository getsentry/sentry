import logging
from datetime import timedelta
from uuid import uuid4

from django.apps import apps
from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, JSONField, Model

delete_logger = logging.getLogger("sentry.deletions.api")


def default_guid():
    return uuid4().hex


def default_date_schedule():
    return timezone.now() + timedelta(days=30)


class ScheduledDeletion(Model):
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

    class Meta:
        unique_together = (("app_label", "model_name", "object_id"),)
        app_label = "sentry"
        db_table = "sentry_scheduleddeletion"

    @classmethod
    def schedule(cls, instance, days=30, hours=0, data=None, actor=None):
        model_name = type(instance).__name__
        record, created = cls.objects.update_or_create(
            app_label=instance._meta.app_label,
            model_name=model_name,
            object_id=instance.pk,
            defaults={
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

    def get_actor(self):
        from sentry.models import User

        if not self.actor_id:
            return None

        try:
            return User.objects.get(id=self.actor_id)
        except User.DoesNotExist:
            return None
